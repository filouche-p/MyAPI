import 'dotenv/config';
import express from 'express';
import { alasql, saveTable } from './db.js';
import { authenticateToken, generateToken } from './utils.js';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express config ---
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// --- Config ---
const PAGE_LIMIT = process.env.PAGE_LIMIT || 20;


// Middleware to verify if table exists
const checkTableExists = (req, res, next) => {
    const tableName = req.params.table_name;
    if (!alasql.tables[tableName]) {
        return res.status(404).json({ error: `Table '${tableName}' not found.` });
    }
    next();
};

// Authentication
app.get('/register', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/register.html'));
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(401).json({ error: 'Username or password invalid.' });
    }

    const existingUser = alasql('SELECT * FROM users WHERE key_name = ?', [username]);
    if (existingUser.length > 0) {
        return res.status(401).json({ error: 'User with this user name already exists.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    alasql('INSERT INTO users VALUES ?', [{ key_name: username, password: hashedPassword }]);
    saveTable('users');
    
    return res.status(201).redirect('/login');
});

app.get('/login', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }

    const existingUser = alasql('SELECT * FROM users WHERE key_name = ?', [username]);
    if (existingUser.length === 0) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }
    
    const passwordCorrect = await bcrypt.compare(password, existingUser[0].password);

    if (!passwordCorrect) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }

    const token = generateToken({ username });
    return res.status(201).json({ message: 'Login success', token });
});

// GET all with pagination
app.get('/api/:table_name', checkTableExists, (req, res) => {
    const tableName = req.params.table_name;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * PAGE_LIMIT;

    const countResult = alasql(`SELECT COUNT(*) as total FROM ${tableName}`);
    const totalItems = countResult[0].total;

    const resSQL = alasql(`SELECT * FROM ${tableName} LIMIT ${PAGE_LIMIT} OFFSET ${offset}`);

    res.json({
        page,
        limit: PAGE_LIMIT,
        totalItems,
        totalPages: Math.ceil(totalItems / PAGE_LIMIT),
        data: resSQL
    });
});

// GET (Read)
app.get('/api/:table_name/:key_name', checkTableExists, (req, res) => {
    const keyName = req.params.key_name;
    const tableName = req.params.table_name;
    const data = alasql(`SELECT * FROM ${tableName} WHERE key_name = ?`, [keyName]);

    if (data.length > 0) {
        res.json(data[0]);
    } else {
        res.status(404).json({ error: "Specified data not found" });
    }
});

// POST (Create)
app.post('/api/:table_name', authenticateToken, checkTableExists, (req, res) => {
    // Middleware for auth
    const tableName = req.params.table_name;
    const newData = req.body;

    if (!newData.key_name) {
        return res.status(400).json({ error: "Missing 'key_name' in request body." });
    }

    const existing = alasql(`SELECT * FROM ${tableName} WHERE key_name = ?`, [newData.key_name]);
    if (existing.length > 0) {
        return res.status(409).json({ error: "Data already exists." });
    }

    alasql(`INSERT INTO ${tableName} VALUES ?`, [newData]);
    saveTable(tableName);

    res.status(201).json({ message: "Data created", data: newData });
});

// PUT (Update)
app.put('/api/:table_name/:key_name', authenticateToken, checkTableExists, (req, res) => {
    // Middleware for auth
    const tableName = req.params.table_name;
    const keyName = req.params.key_name;
    const newData = req.body;

    const existing = alasql(`SELECT * FROM ${tableName} WHERE key_name = ?`, [keyName]);
    if (!existing.length) {
        return res.status(404).json({ error: "Data doesn't exist." });
    }

    // Update the record directly in the in-memory array for safety and simplicity
    const tableData = alasql.tables[tableName].data;
    const rowIndex = tableData.findIndex(row => row.key_name === keyName);
    
    if (rowIndex !== -1) {
        tableData[rowIndex] = { ...tableData[rowIndex], ...newData, key_name: keyName };
        saveTable(tableName);
        res.json({ message: "Data updated", data: tableData[rowIndex] });
    } else {
        res.status(404).json({ error: "Data not found." });
    }
});

// DELETE
app.delete('/api/:table_name/:key_name', authenticateToken, checkTableExists, (req, res) => {
    // Middleware for auth
    const tableName = req.params.table_name;
    const keyName = req.params.key_name;

    const existing = alasql(`SELECT * FROM ${tableName} WHERE key_name = ?`, [keyName]);
    if (!existing.length) {
        return res.status(404).json({ error: "Data doesn't exist." });
    }

    alasql(`DELETE FROM ${tableName} WHERE key_name = ?`, [keyName]);
    saveTable(tableName);

    res.json({ message: "Data deleted" });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const versionInfo = alasql(`SELECT * FROM version;`);
    console.log(versionInfo);
});