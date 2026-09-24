/**
 * Global application state object.
 * Replaces the use of the `global` object.
 * @type {Object}
 * @property {boolean} isUpdating - Indicates if the database is currently being updated.
 * @property {Date|null} startTime - The start time of the ongoing update.
 * @property {Date|null} expectedEndTime - The estimated end time of the ongoing update.
 * @property {string} currentVersion - The current version of the data.
 * @property {string} targetVersion - The target version being downloaded.
 */
export const updateState = {
    isUpdating: false,
    startTime: null,
    expectedEndTime: null,
    currentVersion: 'inconnue',
    targetVersion: 'inconnue'
};
