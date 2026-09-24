import 'dotenv/config';
import express from 'express';
import { connectDB, getDB, mergeDatabaseWithJSON } from './db.js';
import { authenticateToken } from './utils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectRedis } from './cache.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import { updateState } from './state.js';
import { runMinecraftUpdate } from './services/updater.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express config ---
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Global Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use(apiLimiter);

let maintenanceHtmlTemplate = '';
try {
    maintenanceHtmlTemplate = fs.readFileSync(path.join(__dirname, '../public/maintenance.html'), 'utf8');
} catch (e) {
    console.error('Failed to load maintenance.html:', e);
}

// Maintenance middleware
app.use((req, res, next) => {
    if (updateState.isUpdating && req.path !== '/api/admin/force-update') {
        if (req.path.startsWith('/api')) {
            return res.status(503).json({
                error: "Maintenance in progress",
                message: "The database is currently being updated with the latest Minecraft version.",
                currentVersion: updateState.currentVersion,
                targetVersion: updateState.targetVersion,
                startTime: updateState.startTime,
                expectedEndTime: updateState.expectedEndTime
            });
        } else {
            let html = maintenanceHtmlTemplate;
            if (html) {
                html = html.replace('{{START_TIME}}', updateState.startTime ? updateState.startTime.toLocaleString('en-US') : '');
                html = html.replace('{{END_TIME}}', updateState.expectedEndTime ? updateState.expectedEndTime.toLocaleString('en-US') : '');
                html = html.replace('{{CURRENT_VERSION}}', updateState.currentVersion);
                html = html.replace('{{TARGET_VERSION}}', updateState.targetVersion);
                return res.status(503).send(html);
            } else {
                return res.status(503).json({ error: "Maintenance in progress" });
            }
        }
    }
    next();
});

// Swagger docs
const file = fs.readFileSync(path.join(__dirname, '../swagger.yaml'), 'utf8');
const swaggerDocument = YAML.parse(file);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get('/health', (req, res) => {
    const date = new Date();
    return res.status(200).json({ message: 'Ok', date: date.toLocaleString('en-US') });
});

// Mount Routes
app.use('/', authRoutes); // /login, /register, /logout, /google
app.use('/auth', authRoutes); // /auth/login, /auth/google, etc.
app.use('/api', apiRoutes); // /api/:table_name

// README endpoint
app.get('/api/readme', (req, res) => {
    res.sendFile(path.join(__dirname, '../README.md'));
});

// Admin route
app.post('/api/admin/force-update', authenticateToken, async (req, res) => {
    if (updateState.isUpdating) {
        return res.status(409).json({ error: 'An update is already in progress.' });
    }
    
    // Launch in background
    runMinecraftUpdate();
    res.json({ message: 'Minecraft update has been launched in the background.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize connections and start server
async function startServer() {
    await connectRedis();
    await connectDB();

    app.listen(PORT, async () => {
        console.log(`Server running on http://localhost:${PORT}`);
        const db = getDB();
        if (db) {
            const versionInfo = await db.collection('version').findOne({}, { projection: { _id: 0 } });
            console.log(versionInfo);
        }
        
        // Merge JSON data potentially downloaded by 'npm run prestart' in the background
        mergeDatabaseWithJSON().catch(err => console.error('Error during background merge:', err));

        // Cron job: Fetch Minecraft data every Wednesday at 3:00 AM
        cron.schedule('0 3 * * 3', () => {
            runMinecraftUpdate();
        });
    });
}

startServer();