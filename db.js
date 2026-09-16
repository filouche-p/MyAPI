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
                
                const rawData = fs.readFileSync(filePath, 'utf8');
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