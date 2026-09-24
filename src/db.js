import { MongoClient } from 'mongodb';
import pc from 'picocolors';
import fs from 'fs';

import path from 'path';

export const DB_CONFIG = {};
const dbDir = './db';
if (fs.existsSync(dbDir)) {
    fs.readdirSync(dbDir).forEach(file => {
        if (file.endsWith('.json')) {
            const collectionName = path.basename(file, '.json');
            DB_CONFIG[collectionName] = path.join(dbDir, file);
        }
    });
}

let client;
let db;

/**
 * Connects to the MongoDB database and initializes seeding if necessary.
 * 
 * @returns {Promise<void>}
 */
export async function connectDB() {
    const url = process.env.MONGO_URL || 'mongodb://localhost:27017/myapi';
    client = new MongoClient(url);
    
    let retries = 5;
    while (retries > 0) {
        try {
            await client.connect();
            db = client.db();
            console.log(`[DB] ${pc.green('Connected to MongoDB')}`);
            await seedDatabaseIfNeeded();
            break;
        } catch (err) {
            console.error(`[DB] ${pc.red('Failed to connect to MongoDB, retrying in 2 seconds...')} (${retries} retries left)`);
            retries -= 1;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    if (!db) {
        console.error(`[DB] ${pc.red('Could not connect to MongoDB after multiple retries.')}`);
        process.exit(1);
    }
}

/**
 * Gets the active MongoDB database instance.
 * 
 * @returns {Object} The active MongoDB instance or undefined if not connected.
 */
export function getDB() {
    return db;
}

async function seedDatabaseIfNeeded() {
    for (const [collectionName, filePath] of Object.entries(DB_CONFIG)) {
        try {
            const collection = db.collection(collectionName);
            const count = await collection.countDocuments();
            
            if (count === 0 && fs.existsSync(filePath)) {
                console.log(`${pc.bold(`[${pc.magenta('DB')}]`)} Seeding collection '${collectionName}'...`);
                
                const rawData = await fs.promises.readFile(filePath, 'utf8');
                const jsonData = JSON.parse(rawData);
                
                let dataArray = [];
                
                if (Array.isArray(jsonData)) {
                    dataArray = jsonData.map((item, index) => ({
                        key_name: item.name !== undefined ? String(item.name) : (item.id !== undefined ? String(item.id) : String(index)),
                        ...item
                    }));
                } else if (collectionName === 'version' || collectionName === 'loginPacket') {
                    dataArray = [jsonData];
                } else {
                    dataArray = Object.keys(jsonData).map(key => {
                        const val = jsonData[key];
                        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                            return { key_name: key, ...val };
                        } else {
                            return { key_name: key, value: val };
                        }
                    });
                }
                
                if (dataArray.length > 0) {
                    await collection.insertMany(dataArray);
                    console.log(`${pc.bold(`[${pc.magenta('DB')}]`)} Collection '${collectionName}' ${pc.green('seeded')}.`);
                }
            }
        } catch (err) {
            console.error(`[DB] ${pc.red('Error seeding collection')} '${pc.bold(collectionName)}':`, err.message);
        }
    }
}

/**
 * Merges freshly downloaded JSON files with the existing MongoDB database.
 * Does not overwrite entries that were customized or deleted by the user.
 * 
 * @returns {Promise<void>}
 */
export async function mergeDatabaseWithJSON() {
    // Update DB_CONFIG in case new files were downloaded
    if (fs.existsSync(dbDir)) {
        fs.readdirSync(dbDir).forEach(file => {
            if (file.endsWith('.json')) {
                const collectionName = path.basename(file, '.json');
                DB_CONFIG[collectionName] = path.join(dbDir, file);
            }
        });
    }

    const deletedRecordsCol = db.collection('deleted_records');
    
    for (const [collectionName, filePath] of Object.entries(DB_CONFIG)) {
        try {
            console.log(`${pc.bold(`[${pc.magenta('DB')}]`)} Merging collection '${collectionName}'...`);
            const collection = db.collection(collectionName);
            
            // 1. Get user-deleted keys
            const deletedDocs = await deletedRecordsCol.find({ table: collectionName }).toArray();
            const deletedKeys = new Set(deletedDocs.map(d => d.key_name));
            
            // 2. Get user-modified keys
            const modifiedDocs = await collection.find({ customized_by_user: true }, { projection: { key_name: 1 } }).toArray();
            const modifiedKeys = new Set(modifiedDocs.map(d => d.key_name));
            
            if (!fs.existsSync(filePath)) continue;

            const rawData = await fs.promises.readFile(filePath, 'utf8');
            const jsonData = JSON.parse(rawData);
            
            let dataArray = [];
            
            if (Array.isArray(jsonData)) {
                dataArray = jsonData.map((item, index) => ({
                    key_name: item.name !== undefined ? String(item.name) : (item.id !== undefined ? String(item.id) : String(index)),
                    ...item
                }));
            } else if (collectionName === 'version' || collectionName === 'loginPacket') {
                dataArray = [jsonData];
                if (dataArray[0] && !dataArray[0].key_name) {
                   dataArray[0].key_name = 'default';
                }
            } else {
                dataArray = Object.keys(jsonData).map(key => {
                    const val = jsonData[key];
                    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        return { key_name: key, ...val };
                    } else {
                        return { key_name: key, value: val };
                    }
                });
            }
            
            const bulkOps = [];
            for (const item of dataArray) {
                if (deletedKeys.has(item.key_name)) continue;
                if (modifiedKeys.has(item.key_name)) continue;
                
                bulkOps.push({
                    updateOne: {
                        filter: { key_name: item.key_name },
                        update: { $set: item },
                        upsert: true
                    }
                });
            }
            
            if (bulkOps.length > 0) {
                await collection.bulkWrite(bulkOps);
            }
            console.log(`${pc.bold(`[${pc.magenta('DB')}]`)} Collection '${collectionName}' ${pc.green('merged')}.`);
        } catch (err) {
            console.error(`[DB] ${pc.red('Error merging collection')} '${pc.bold(collectionName)}':`, err.message);
        }
    }
}