import 'dotenv/config';
import express from 'express';
import { connectDB, getDB, DB_CONFIG } from './db.js';
import { authenticateToken, generateToken } from './utils.js';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectRedis, cacheGet, invalidateCache } from './cache.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express config ---
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Serve Vite frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'frontend/dist')));
}

const file = fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8');
const swaggerDocument = YAML.parse(file);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- Config ---
const PAGE_LIMIT = process.env.PAGE_LIMIT || 20;

app.get('/health', (req, res) => {
    const date = new Date();
    return res.status(200).json({ message: 'Ok', date: date.toLocaleString('fr-FR') });
});

app.get('/', (req, res) => {
    return res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Middleware to verify if table exists
const checkTableExists = (req, res, next) => {
    const tableName = req.params.table_name;
    if (!Object.keys(DB_CONFIG).includes(tableName)) {
        return res.status(404).json({ error: `Table '${tableName}' not found or not allowed.` });
    }
    next();
};



app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(401).json({ error: 'Username or password invalid.' });
    }

    const db = getDB();
    const existingUser = await db.collection('users').findOne({ key_name: username });
    
    if (existingUser) {
        return res.status(401).json({ error: 'User with this user name already exists.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection('users').insertOne({ key_name: username, password: hashedPassword });
    
    return res.status(201).json({ message: 'User created successfully' });
});



app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }

    const db = getDB();
    const existingUser = await db.collection('users').findOne({ key_name: username });
    
    if (!existingUser) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }
    
    const passwordCorrect = await bcrypt.compare(password, existingUser.password);

    if (!passwordCorrect) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }

    const token = generateToken({ username });
    return res.status(201).json({ message: 'Login success', token });
});

// GET all with pagination and dynamic filtering
app.get('/api/:table_name', checkTableExists, cacheGet, async (req, res) => {
    const tableName = req.params.table_name;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * PAGE_LIMIT;

    // Build the dynamic query
    const query = { ...req.query };
    delete query.page; // Remove pagination param
    
    // Convert strings to booleans or numbers if applicable (for MongoDB strict typing)
    for (const key in query) {
        if (key.endsWith('_like')) {
            // Partial search support (e.g. ?name_like=dirt)
            const actualKey = key.slice(0, -5); 
            query[actualKey] = { $regex: query[key], $options: 'i' }; // Case-insensitive regex
            delete query[key];
        } else if (query[key] === 'true') {
            query[key] = true;
        } else if (query[key] === 'false') {
            query[key] = false;
        } else if (!isNaN(query[key]) && query[key].trim() !== '' && key !== 'key_name') {
            // Convert to number, but preserve key_name as string (since we force it to string in db.js)
            query[key] = Number(query[key]);
        }
    }

    const db = getDB();
    const collection = db.collection(tableName);
    
    try {
        const totalItems = await collection.countDocuments(query);
        const data = await collection.find(query, { projection: { _id: 0 } }).skip(offset).limit(PAGE_LIMIT).toArray();

        res.json({
            page,
            limit: PAGE_LIMIT,
            totalItems,
            totalPages: Math.ceil(totalItems / PAGE_LIMIT),
            data
        });
    } catch (err) {
        console.error("GET error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET (Read)
app.get('/api/:table_name/:key_name', checkTableExists, cacheGet, async (req, res) => {
    const keyName = req.params.key_name;
    const tableName = req.params.table_name;
    
    const db = getDB();
    try {
        const data = await db.collection(tableName).findOne({ key_name: keyName }, { projection: { _id: 0 } });

        if (data) {
            res.json(data);
        } else {
            res.status(404).json({ error: "Specified data not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// POST (Create)
app.post('/api/:table_name', authenticateToken, checkTableExists, async (req, res) => {
    const tableName = req.params.table_name;
    const newData = req.body;

    if (!newData.key_name) {
        return res.status(400).json({ error: "Missing 'key_name' in request body." });
    }

    const db = getDB();
    try {
        const collection = db.collection(tableName);
        const existing = await collection.findOne({ key_name: newData.key_name });
        
        if (existing) {
            return res.status(409).json({ error: "Data already exists." });
        }

        await collection.insertOne(newData);
        invalidateCache(tableName);

        // Remove _id from response for consistency
        delete newData._id;
        res.status(201).json({ message: "Data created", data: newData });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// PUT (Update)
app.put('/api/:table_name/:key_name', authenticateToken, checkTableExists, async (req, res) => {
    const tableName = req.params.table_name;
    const keyName = req.params.key_name;
    const newData = req.body;

    // Prevent _id or key_name overwrite
    delete newData._id;
    newData.key_name = keyName;

    const db = getDB();
    try {
        const collection = db.collection(tableName);
        
        const result = await collection.findOneAndUpdate(
            { key_name: keyName },
            { $set: newData },
            { returnDocument: 'after', projection: { _id: 0 } }
        );

        if (result) {
            invalidateCache(tableName);
            res.json({ message: "Data updated", data: result });
        } else {
            res.status(404).json({ error: "Data not found." });
        }
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// DELETE
app.delete('/api/:table_name/:key_name', authenticateToken, checkTableExists, async (req, res) => {
    const tableName = req.params.table_name;
    const keyName = req.params.key_name;

    const db = getDB();
    try {
        const result = await db.collection(tableName).deleteOne({ key_name: keyName });
        
        if (result.deletedCount > 0) {
            invalidateCache(tableName);
            res.json({ message: "Data deleted" });
        } else {
            return res.status(404).json({ error: "Data doesn't exist." });
        }
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// Initialize connections
await connectRedis();
await connectDB();

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const db = getDB();
    if (db) {
        const versionInfo = await db.collection('version').findOne({}, { projection: { _id: 0 } });
        console.log(versionInfo);
    }
});