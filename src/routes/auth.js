import express from 'express';
import bcrypt from 'bcrypt';
import { getDB } from '../db.js';
import { generateToken, authenticateToken } from '../utils.js';
import { OAuth2Client } from 'google-auth-library';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 auth requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' }
});

const validateAuthInput = (username, password) => {
    if (!username || username.length <= 2) return 'Username must be at least 3 characters long.';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores.';
    if (!password || password.length < 6) return 'Password must be at least 6 characters long.';
    return null;
};

/**
 * Register a new user
 */
router.post('/register', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    const validationError = validateAuthInput(username, password);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const db = getDB();
    const existingUser = await db.collection('users').findOne({ key_name: username });
    
    if (existingUser) {
        return res.status(401).json({ error: 'User with this user name already exists.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection('users').insertOne({ key_name: username, password: hashedPassword, role: 'user' });
    
    return res.status(201).json({ message: 'User created successfully' });
});

/**
 * Login a user and set a cookie token
 */
router.post('/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Please provide both username and password.' });
    }

    const db = getDB();
    const existingUser = await db.collection('users').findOne({ key_name: username });
    
    if (!existingUser) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }
    
    const passwordCorrect = await bcrypt.compare(password, existingUser.password);

    if (!passwordCorrect) {
        return res.status(401).json({ error: 'Login fail, check username and password.' });
    }

    const token = generateToken({ username, role: existingUser.role || 'user' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    return res.status(201).json({ message: 'Login success' });
});

/**
 * Logout the user by clearing the cookie
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    return res.status(200).json({ message: 'Logout success' });
});

/**
 * Get current logged in user info
 */
router.get('/me', authenticateToken, (req, res) => {
    return res.status(200).json({ user: req.user });
});

// --- Google OAuth ---
const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

router.get('/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
    });
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        const db = getDB();
        let user = await db.collection('users').findOne({ key_name: payload.email });
        
        if (!user) {
            user = { 
                key_name: payload.email, 
                email: payload.email, 
                auth_provider: 'google', 
                googleId: payload.sub,
                role: 'user'
            };
            await db.collection('users').insertOne(user);
        }

        const token = generateToken({ username: user.key_name, role: user.role || 'user' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:8081/');
    } catch (err) {
        console.error("Google Auth Error:", err);
        res.status(500).json({ error: 'Google Auth Error' });
    }
});

export default router;
