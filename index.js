import { getAllJsonFiles, getJsonData } from './db.js';
import { fileURLToPath } from 'url';
import fs from "node:fs/promises";
import jwt from 'jsonwebtoken';
import express from 'express';
import path from "node:path";
import bcrypt from 'bcrypt';

const app = express();
const port = 8080;
const users = []

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

        res.json(allData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la lecture des données" });
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
        res.json(await getJsonData(fileName));
    } catch (error) {
        res.send(`Error while getting ${fileName}, must be one of ${await getAllJsonFiles(dir)}<br>.json extension is automaticly added`)
    }
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, 'public/src/html/register.html'));
});

app.post("/register", async (req, res) => {
    const {username, password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = { username: username, password: hashedPassword };
    users.push(user);
    
    res.json(auth);
    res.status(201).json({ message: 'Utilisateur créé' });
});

app.get("/login");

app.post("/login");

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});