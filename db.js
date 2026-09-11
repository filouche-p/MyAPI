// import { constants } from "node:buffer";
import { constants } from "fs";
import fs from "fs/promises";
import assert from "assert";
import sql from 'alasql';
import path from "path";

// Auto get json db file
async function getAllJsonFiles(parentDir) {
    // check is parentDir exist is a dir and have access (fs.stats)
    const entries = await fs.readdir(parentDir);
    const jsonList = entries.filter((file) => file.endsWith('.json'));

    return jsonList;
}

// Return json of a unique json file
async function getJsonData(filePath) {
    assert(path.extname(filePath), 'path doesn\'t match json file (check extension)');

    await fs.access(filePath, constants.R_OK);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}

// Setup and Fill Up Database
async function initDB(dbDir='./db/') {
    var db = new sql.Database('data');

    try {
        const fileList = await getAllJsonFiles(dbDir);
        
        for (const fileName of fileList) {
            const tableName = fileName.replace('.json', '');
            const fullPath = path.join(dbDir, fileName);

            let data = await getJsonData(fullPath);
            data = Array.isArray(data) ? data : [data];

            db.exec(`CREATE TABLE IF NOT EXISTS [${tableName}];`);
            if (data.length > 0) {
                db.exec(`INSERT INTO [${tableName}] SELECT * FROM ?`, [data]);
            }
        }
    } catch (error) {
        console.error(error);
    }


    return db;
}

export {
    getAllJsonFiles,
    getJsonData,
    initDB
}