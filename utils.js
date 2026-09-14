export async function isLogged(params) {
    return true;
}

export async function isAdmin(params) {
    const isAdmin = true;
    return isLogged(params) && isAdmin;
}

export function getColumns(db, tableName) {
    try {
        const result = db.exec(`SELECT TOP 1 * FROM ${tableName}`);
        const columns = Object.keys(result[0] || {}).join(', ');

        if (!columns) {
            return { error : "Table vide ou inexistante." };
        }

        return { data : columns };
    } catch (err) {
        return { error : err.message };
    }
}