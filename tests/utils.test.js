import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Setup env var before importing utils
process.env.JWT_SECRET = 'test-secret';
const { generateToken, authenticateToken } = await import('../src/utils.js');

describe('Utils: Authentication', () => {
    it('should generate a valid JWT token', () => {
        const payload = { username: 'testuser' };
        const token = generateToken(payload);
        
        expect(token).toBeDefined();
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.username).toBe(payload.username);
    });

    it('should authenticate a valid token', () => {
        const token = generateToken({ username: 'testuser' });
        
        const req = {
            headers: {
                authorization: `Bearer ${token}`
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        authenticateToken(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(req.user.username).toBe('testuser');
    });

    it('should authenticate a valid token from cookies', () => {
        const token = generateToken({ username: 'cookieuser' });
        
        const req = {
            cookies: {
                token: token
            },
            headers: {}
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        authenticateToken(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(req.user.username).toBe('cookieuser');
    });

    it('should return 401 if no token is provided', () => {
        const req = { headers: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        authenticateToken(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Access denied. No token provided." });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if token is invalid', () => {
        const req = { headers: { authorization: 'Bearer invalid-token' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        authenticateToken(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token." });
        expect(next).not.toHaveBeenCalled();
    });
});
