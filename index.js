import { getAllJsonFiles, getJsonData } from './db.js';
import { fileURLToPath } from 'url';
import fs from "node:fs/promises";
import jwt from 'jsonwebtoken';
import express from 'express';
import path from "node:path";
import bcrypt from 'bcrypt';

const app = express();
const port = 8080;
const users = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get("/all", async (req, res) => {
    try {
        const dbDir = "./db";
        const fileList = await getAllJsonFiles(dbDir);

        const allData = [];

        for (const fileName of fileList) {
            const fullPath = path.join(dbDir, fileName);
            const data = await getJsonData(fullPath);
            allData.push(data);
        }

        return res.json(allData);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur lors de la lecture des données" });
    }
});

app.get("/get", async (req, res) => {
    const dir = "./db/";
    const q = req.query;
    // const allSelector = ['*', 'all'];
    // if (q.name.toLowerCase() in allSelector) {
    //     const fileName =
    // }

    
    const fileName = `${dir}${q.name}.json`;

    try {
        fs.access(filePath, constants.R_OK);
        return res.json(await getJsonData(fileName));
    } catch (error) {
        return res.send(`Error while getting ${fileName}, must be one of ${await getAllJsonFiles(dir)}<br>.json extension is automaticly added`)
    }
});

app.get("/register", (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/register.html'));
});

app.post("/register", async (req, res) => {
    // Check for empty
    const {username, password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    users[username] = hashedPassword;
    
    console.log(users);

    return res.status(201).json({ message: 'Utilisateur créé' });
});

app.get("/login", (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/src/html/login.html'))
});

app.post("/login", async (req, res) => {
    const {username, password} = req.body;
    console.log(password);
    console.log(users[0][username]);
    const passwordCorrect = await bcrypt.compare(password, users[username]);
    console.log(passwordCorrect);
    // const user = { username: hashedPassword } || {};
    console.log();

    // if (!user) {
    //     return res.status(401).json('Login empty please retry');
    // }

    if (!passwordCorrect) {
        console.log("fail");
        return res.status(401).json('Login fail, check username and password.');
    }

    // else the user is logged in
    return res.status(201).json('Login success');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});