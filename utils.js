import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;

if(!SECRET_KEY) {
    throw new Error('Fatal : JWT_SECRET env variable must be set up.');
} 

const reset = "\x1b[0m";
const foreBlack = "\x1b[30m";
const foreRed = "\x1b[31m";
const foreGreen = "\x1b[32m";
const foreYellow = "\x1b[33m";
const foreBlue = "\x1b[34m";
const foreMagenta = "\x1b[35m";
const foreCyan = "\x1b[36m";
const foreWhite = "\x1b[37m";

const bold = "\x1b[1m";
const italic = "\x1b[3m";
const underline = "\x1b[4m";

function generateToken(userPayload) {
    return jwt.sign(userPayload, SECRET_KEY, { expiresIn: '1h' });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token." });
        }
        
        req.user = user;
        next();
    });
}

export {
    generateToken,
    authenticateToken
};