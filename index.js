import { getAllJsonFiles, getJsonData, initDB } from './db.js';
import { fileURLToPath } from 'url';
import fs from "node:fs/promises";
import jwt from 'jsonwebtoken';
import express from 'express';
import path from "node:path";
import bcrypt from 'bcrypt';
import { table } from 'node:console';

const app = express();
const port = 8080;
const dbDir = "./db/";
const users = {'admin': await bcrypt.hash('admin', 10)};

var db = await initDB();
const allTables = await db.exec('SHOW tables;');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/all', async (req, res) => {
    // Whitelist and Blacklist ?
    // table settings pour modifier ce genre de settings, sauvegarder en json laod la première fois depuis le env ?
    const blacklist = ['attributes'];
    let listeTables = Object.keys(db.tables).filter(tableName => !blacklist.includes(tableName));

    console.log(`Tables créées :${listeTables}`);

    let data = {};

    for (const tableName of listeTables) {
        const tableData = db.exec(`SELECT * FROM ${tableName};`);
        data[tableName] = tableData;
    }

    return res.status(200).json(data);
});

app.get('/get', async (req, res) => {
    const query = req.query; // filter possible query arg ?
    console.log(query);

    const possibleQuery = ['table'];
    const queryKey = Object.keys(query);
    const queryKeyPatch = queryKey.filter(param => possibleQuery.includes(param));

    console.log(queryKey.length == queryKeyPatch.length ? `RAS` : `Paramètres suivant del : ${queryKey.filter(param => !possibleQuery.includes(param))}`);

    // boucler sur query rajouter une condition si on est pas dans queryPatch on pass
    // table obliger + vérif existances
    console.log(allTables, query['table']);
    if(!allTables.includes(query['table'])) {
        return res.status(401).json('tablename unvalaible');
    }

    const data = db.exec(`SELECT * FROM ${query['table']}`);
    return res.status(200).json(data);
});

app.get("/getOLD", async (req, res) => {
    // Obselete
    const q = req.query;
    const fileName = `${dbDir}${q.name}.json`;

    try {
        fs.access(filePath, constants.R_OK);
        return res.json(await getJsonData(fileName));
    } catch (error) {
        return res.send(`Error while getting ${fileName}, must be one of ${await getAllJsonFiles(dbDir)}<br>.json extension is automaticly added`);
    }
});

app.get("/register", (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/register.html'));
});

app.post("/register", async (req, res) => {
    // Check for empty
    const {username, password} = req.body;
    if (users[username]) {
        return res.status(401).json('User with this user name already exists.');
    }
    
    if (!username || !password) {
        return res.status(401).json('Username or password invalid.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    users[username] = hashedPassword;
    
    console.log(users);

    return res.status(201).redirect('/login');
});

app.get("/login", (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/login.html'))
});

app.post("/login", async (req, res) => {
    const {username, password} = req.body;
    if (!users[username]) {
        return res.status(401).json('Login fail, check username and password.');
    }
    const passwordCorrect = await bcrypt.compare(password, users[username]);

    if (!passwordCorrect) {
        return res.status(401).json('Login fail, check username and password.');
    }

    // else the user is logged in
    // send token
    return res.status(201).json('Login success');
});

app.listen(port, async () => {
    console.log(`Starting up express..`);
    console.log(`Loading database :`);

    const res = db.exec(`SELECT * FROM version;`);
    console.log(res);
    
    console.log(`Example app listening on port ${port}`);
});