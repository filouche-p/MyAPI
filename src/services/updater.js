import { updateState } from '../state.js';
import { getDB, mergeDatabaseWithJSON } from '../db.js';
import { fetchLatestMinecraftData } from '../../scripts/fetch_minecraft_data.js';

/**
 * Runs the Minecraft data update process in the background.
 * It fetches the latest data and merges it into the database.
 * 
 * @returns {Promise<void>}
 */
export async function runMinecraftUpdate() {
    if (updateState.isUpdating) return;
    
    updateState.isUpdating = true;
    updateState.startTime = new Date();
    // Empirical estimate of 2 minutes
    updateState.expectedEndTime = new Date(Date.now() + 2 * 60000);
    
    try {
        const db = getDB();
        const versionInfo = await db.collection('version').findOne({});
        updateState.currentVersion = versionInfo ? versionInfo.key_name : 'unknown';
        
        console.log('⏰ Starting Minecraft update...');
        
        // 1. Fetch
        const fetchResult = await fetchLatestMinecraftData();
        if (fetchResult.status === 'success') {
            updateState.targetVersion = fetchResult.version;
            // 2. Merge
            await mergeDatabaseWithJSON();
            console.log('✅ Minecraft update completed successfully.');
        } else {
            console.error('❌ Fetch failed, merge canceled.');
        }
    } catch (err) {
        console.error('❌ Critical error during update:', err);
    } finally {
        updateState.isUpdating = false;
    }
}
