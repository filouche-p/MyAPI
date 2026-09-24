import { jest } from '@jest/globals';

describe('Environment Variables', () => {
    // Save original env
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should throw an error if JWT_SECRET is not set', async () => {
        delete process.env.JWT_SECRET;
        
        try {
            await import('../src/utils.js?bust=' + Date.now());
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error.message).toBe('Fatal : JWT_SECRET env variable must be set up.');
        }
    });

    it('should not throw if JWT_SECRET is set', async () => {
        process.env.JWT_SECRET = 'some-secret-key';
        
        const utils = await import('../src/utils.js?bust=' + Date.now());
        expect(utils.generateToken).toBeDefined();
    });
});
