import fs from 'fs';
import alasql from 'alasql';

const reset = "\x1b[0m";
const foreBlack = "\x1b[30m";
const foreRed = "\x1b[31m";
const foreGreen = "\x1b[32m";
const foreYellow = "\x1b[33m";
const foreBlue = "\x1b[34m";
const foreMagenta = "\x1b[35m";
const foreCyan = "\x1b[36m";
const foreWhite = "\x1b[37m";

const bold = "\x1b[1m";
const italic = "\x1b[3m";
const underline = "\x1b[4m";

const DB_CONFIG = {
    attributes: './db/attributes.json',
    biomes: './db/biomes.json',
    blockCollisionShapes: './db/blockCollisionShapes.json',
    blocks: './db/blocks.json',
    effects: './db/effects.json',
    enchantments: './db/enchantments.json',
    entities: './db/entities.json',
    foods: './db/foods.json',
    instruments: './db/instruments.json',
    items: './db/items.json',
    language: './db/language.json',
    loginPacket: './db/loginPacket.json',
    particles: './db/particles.json',
    protocol: './db/protocol.json',
    recipes: './db/recipes.json',
    sounds: './db/sounds.json',
    tints: './db/tints.json',
    version: './db/version.json',
    users: './db/users.json'
};

const tableFormats = {}; 

// Universal translator for sql (everything needs to be an array)
// We don't use alasql function cause it's slow and have it's own limit
// File to SQL
function loadDatabase() {
    for (const [tableName, filePath] of Object.entries(DB_CONFIG)) {
        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(rawData);
            
            let dataArray = [];

            if (Array.isArray(jsonData)) {
                tableFormats[tableName] = 'array';
                dataArray = jsonData.map((item, index) => ({
                    key_name: item.name !== undefined ? String(item.name) : (item.id !== undefined ? String(item.id) : String(index)),
                    ...item
                }));
            } else if (tableName === 'version' || tableName === 'loginPacket') {
                tableFormats[tableName] = 'single_object';
                dataArray = [jsonData];
            } else {
                tableFormats[tableName] = 'dictionary';
                dataArray = Object.keys(jsonData).map(key => {
                    const val = jsonData[key];
                    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        return { key_name: key, ...val };
                    } else {
                        return { key_name: key, value: val };
                    }
                });
            }

            alasql(`DROP TABLE IF EXISTS ${tableName}`);
            alasql(`CREATE TABLE ${tableName}`);
            alasql.tables[tableName].data = dataArray; 
            
            console.log(`${bold}[${foreMagenta}DB${reset}${bold}] Table '${tableName}' ${foreGreen}loaded${reset}.`);
        } catch (err) {
            console.error(`[DB] ${foreRed}Error loading table${reset} '${bold}${tableName}${reset}':`, err.message);
            alasql(`CREATE TABLE ${tableName}`);
        }
    }
}

// SQL to file
function saveTable(tableName) {
    try {
        const filePath = DB_CONFIG[tableName];
        if (!filePath) throw new Error("Table not configured");

        const currentDataArray = alasql(`SELECT * FROM ${tableName}`);
        let dataToSave;

        if (tableFormats[tableName] === 'dictionary') {
            dataToSave = {};
            currentDataArray.forEach(row => {
                const { key_name, ...blockData } = row;
                if (key_name) {
                    // Check if we wrapped a primitive or array in a 'value' property
                    if (Object.keys(blockData).length === 1 && 'value' in blockData) {
                        dataToSave[key_name] = blockData.value;
                    } else {
                        dataToSave[key_name] = blockData;
                    }
                }
            });
        } else if (tableFormats[tableName] === 'single_object') {
            dataToSave = currentDataArray[0];
        } else {
            dataToSave = currentDataArray.map(row => {
                const { key_name, ...blockData } = row;
                return blockData;
            });
        }

        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2)); // 2 here to make clear json file
        console.log(`[DB] Table '${tableName}' ${foreGreen}saved${reset}.`);
    } catch (err) {
        console.error(`[DB] ${foreRed}Error saving table${reset} '${bold}${tableName}${reset}':`, err);
    }
}

loadDatabase();

export {
    alasql,
    saveTable
};