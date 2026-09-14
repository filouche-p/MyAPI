import { getAllJsonFiles, getJsonData, initDB } from './db.js';
import { isAdmin, getColumns } from './utils.js';
import { fileURLToPath } from 'url';
// import fs from "node:fs/promises";
// import jwt from 'jsonwebtoken';
import express from 'express';
import path from "node:path";
import bcrypt from 'bcrypt';
// import { table } from 'node:console';

const app = express();
const port = 8080;
const dbDir = "./db/"; // load from env
app.use(express.json());

const users = {'admin': await bcrypt.hash('admin', 10)};

var db = await initDB(dbDir);
const rawTables = db.exec('SHOW tables;');
const allTablesList = rawTables.map(t => t.tableid);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// --- GET (Create read) ---
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
    console.log(allTablesList, query['table']);
    if(!allTablesList.includes(query['table'])) {
        return res.status(401).json('tablename unvalaible');
    }

    const data = db.exec(`SELECT * FROM ${query['table']}`);
    return res.status(200).json(data);
});

// --- POST (CREATE add) ---
app.post('/add', async (req, res) => {
    const query = req.body;
    console.log(query);

    if(!isAdmin(req)) {
        return res.status(401).json({'error' : 'Check your access'});
    }

    if(!query) {
        return res.status(400).json({'error' : 'You need to specify a body attach to your request.'});
    }

    if(!Object.hasOwn(query, 'table')) {
        return res.status(400).json({'error' : `Body need to include the table, must be one of : ${allTablesList}`});
    }

    if (!Object.hasOwn(query, 'columns') || !Array.isArray(query['columns'])) {
        const columnsResult = getColumns(db, query['table']);

        if (columnsResult.error) {
            return res.status(400).json({ error: columnsResult.error });
        }

        return res.status(400).json({
            error: `You need to specify the columns as an array you want to edit. For ${query['table']}, columns are: ${columnsResult.data}`
        });
    }

    if (!Object.hasOwn(query, 'values') || !Array.isArray(query['values']) || query['columns'].length !== query['values'].length) {
        console.log('You need t ospecify the values of the colums, you also need the same number of element in your columns and values acutal : ???');
        return res.status(400).json({ error : "check values" });
    }


    const finalRequest = `INSERT INTO ${query['table']} () VALUES();`;

    // Return value before and after ?
    return res.status(201).json({ message: `Success ${finalRequest}` });
});


// --- UPDATE (Update put)---
app.put('/update', async (req, res) => {
    if(!isAdmin(req)) {
        res.status(401).json('Check your access');
    }

    res.status(204).json('Success');
});


// --- DELETE (Destroy) --- 
app.delete('/delete', async (req, res) => {
    if(!isAdmin(req)) {
        res.status(401).json('Check your access');
    }

    res.status(204).json('Success');
});


// --- Auth --- 
app.get('/register', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/register.html'));
});

app.post('/register', async (req, res) => {
    // Check for empty ?
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

app.get('/login', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/login.html'))
});

app.post('/login', async (req, res) => {
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
    console.log(res[0]);

    console.log('Loaded table :');
    console.log(allTablesList);
    
    console.log(`Example app listening on port ${port}`);
});