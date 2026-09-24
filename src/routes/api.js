import express from 'express';
import { getDB, DB_CONFIG } from '../db.js';
import { authenticateToken, authenticateAdmin } from '../utils.js';
import { cacheGet, invalidateCache } from '../cache.js';

const router = express.Router();
const PAGE_LIMIT = parseInt(process.env.PAGE_LIMIT, 10) || 20;

// Middleware to verify if table exists
const checkTableExists = (req, res, next) => {
    const tableName = req.params.table_name;
    if (!Object.keys(DB_CONFIG).includes(tableName)) {
        return res.status(404).json({ error: `Table '${tableName}' not found or not allowed.` });
    }
    next();
};

/**
 * GET list of all available collections
 */
router.get('/collections', (req, res) => {
    // Return all table names configured in DB_CONFIG
    const collections = Object.keys(DB_CONFIG);
    res.json(collections);
});

/**
 * GET all with pagination and dynamic filtering
 */
router.get('/:table_name', checkTableExists, cacheGet, async (req, res) => {
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

/**
 * GET a specific record
 */
router.get('/:table_name/:key_name', checkTableExists, cacheGet, async (req, res) => {
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

/**
 * POST a new record
 */
router.post('/:table_name', authenticateAdmin, checkTableExists, async (req, res) => {
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

        newData.customized_by_user = true;
        await collection.insertOne(newData);
        invalidateCache(tableName);

        // Remove _id from response for consistency
        delete newData._id;
        res.status(201).json({ message: "Data created", data: newData });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

/**
 * PUT update a record
 */
router.put('/:table_name/:key_name', authenticateAdmin, checkTableExists, async (req, res) => {
    const tableName = req.params.table_name;
    const keyName = req.params.key_name;
    const newData = req.body;

    // Prevent _id or key_name overwrite
    delete newData._id;
    newData.key_name = keyName;
    newData.customized_by_user = true;

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

/**
 * DELETE a record
 */
router.delete('/:table_name/:key_name', authenticateAdmin, checkTableExists, async (req, res) => {
    const tableName = req.params.table_name;
    const keyName = req.params.key_name;

    const db = getDB();
    try {
        const result = await db.collection(tableName).deleteOne({ key_name: keyName });
        
        if (result.deletedCount > 0) {
            await db.collection('deleted_records').updateOne(
                { table: tableName, key_name: keyName },
                { $set: { table: tableName, key_name: keyName, deleted_at: new Date() } },
                { upsert: true }
            );
            invalidateCache(tableName);
            res.json({ message: "Data deleted" });
        } else {
            return res.status(404).json({ error: "Data doesn't exist." });
        }
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

export default router;
