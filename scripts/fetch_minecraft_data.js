import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchWithRetry(url, maxRetries = 5) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
            return response;
        } catch (err) {
            attempt++;
            if (attempt >= maxRetries) {
                throw new Error(`Failed after ${maxRetries} attempts: ${err.message}`);
            }
            await new Promise(res => setTimeout(res, 4000)); // wait 4s before retry
        }
    }
}

/**
 * Fetches the latest Minecraft data from the PrismarineJS repository.
 * Downloads JSON files for the newest PC version and saves them to the db directory.
 * 
 * @returns {Promise<Object>} Status object indicating success or error.
 */
export async function fetchLatestMinecraftData() {
    const dataPathsUrl = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/dataPaths.json';
    const outDir = path.join(__dirname, '../db');
    const baseUrl = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/';

    console.log('⤓ Fetching dataPaths.json...');
    let response;
    try {
        response = await fetchWithRetry(dataPathsUrl, 5);
    } catch (err) {
        console.error(pc.red(`𒒬 Update from minecraft-data failed: ${err.message}`));
        return { status: 'error', error: err.message };
    }
    
    const dataPaths = await response.json();
    
    // latest version on pc
    const pcVersions = Object.keys(dataPaths.pc);
    const latestVersion = pcVersions[pcVersions.length - 1]; 
    
    console.log(`🞋 Latest PC version found: ${latestVersion}`);
    
    const versionData = dataPaths.pc[latestVersion];
    
    // creating folder if not exist
    await fs.mkdir(outDir, { recursive: true });
    
    console.log(`🖿 Files will be saved in: ${outDir}\n`);

    // getting all json fil for this version
    const fetchPromises = Object.entries(versionData).map(async ([key, folderPath]) => {
        const fileUrl = `${baseUrl}${folderPath}/${key}.json`;
        try {
            const fileRes = await fetchWithRetry(fileUrl, 3);
            const fileContent = await fileRes.text();
            const destPath = path.join(outDir, `${key}.json`);
            await fs.writeFile(destPath, fileContent, 'utf-8');
            console.log(`🖪 ${key}.json saved.`);
        } catch (e) {
            // some file doesn't exist anymore
            if (e.message.includes('404')) {
                console.warn(`⚠ File not found on repo: ${key}.json`);
            } else {
                console.error(pc.red(`𒒬 Error while fetching ${key}.json: ${e.message}`));
            }
        }
    });

    await Promise.all(fetchPromises);
    console.log(`\n♨ All data files for version ${latestVersion} have been downloaded!`);
    return { status: 'success', version: latestVersion };
}

if (process.argv[1] === __filename) {
    fetchLatestMinecraftData().catch(err => {
        console.error(pc.red(`𒒬 Global error: ${err.message}`));
    });
}