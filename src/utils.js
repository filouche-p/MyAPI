import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;

if(!SECRET_KEY) {
    throw new Error('Fatal : JWT_SECRET env variable must be set up.');
} 



/**
 * Generates a JSON Web Token (JWT) for a given user payload.
 * 
 * @param {Object} userPayload - The data to encode in the token.
 * @returns {string} The signed JWT token.
 */
function generateToken(userPayload) {
    return jwt.sign(userPayload, SECRET_KEY, { expiresIn: '1h' });
}

/**
 * Express middleware to authenticate a JWT token from cookies or authorization header.
 * 
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 * @returns {Object|void} Sends a 401/403 response on failure or calls next() on success.
 */
function authenticateToken(req, res, next) {
    let token = req.cookies && req.cookies.token;
    
    // Fallback to Bearer token for non-browser clients
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
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

/**
 * Express middleware to authenticate an admin.
 */
function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            return res.status(403).json({ error: "Access denied. Admin privileges required." });
        }
    });
}

export {
    generateToken,
    authenticateToken,
    authenticateAdmin
};