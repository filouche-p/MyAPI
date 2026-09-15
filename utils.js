import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;

if(!SECRET_KEY) {
    throw new Error('Fatal : JWT_SECRET env variable must be set up.');
} 

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