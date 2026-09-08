// import { constants } from "node:buffer";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import assert from "node:assert";
import path from "node:path";

// Auto get json db file
export async function getAllJsonFiles(parentDir) {
    // check is parentDir exist is a dir and have access (fs.stats)
    const entries = await fs.readdir(parentDir);
    const jsonList = entries.filter((file) => file.endsWith('.json'));

    return jsonList;
}

// Return json of a unique json file
export async function getJsonData(filePath) {
    assert(path.extname(filePath), 'path doesn\'t match json file (check extension)');

    await fs.access(filePath, constants.R_OK);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}