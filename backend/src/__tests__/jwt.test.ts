import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/jwt.utils';

const payload = { userId: 1, email: 'test@test.com', role: 'EMPLOYEE', department: 'IT' };

describe('JWT utilities', () => {
  describe('generateAccessToken', () => {
    it('returns a non-empty string', () => {
      const token = generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('verifyAccessToken', () => {
    it('decodes correct userId', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
    });

    it('decodes correct email', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.email).toBe(payload.email);
    });

    it('decodes correct role', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.role).toBe(payload.role);
    });

    it('throws JsonWebTokenError on invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow(jwt.JsonWebTokenError);
    });

    it('throws TokenExpiredError on expired token', () => {
      const expired = jwt.sign(payload, process.env['JWT_SECRET'] ?? 'securedesk-access-secret-dev', {
        expiresIn: -1,
      });
      expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns a non-empty string', () => {
      const token = generateRefreshToken(payload);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('verifyRefreshToken', () => {
    it('decodes correct userId', () => {
      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
    });

    it('throws on invalid token', () => {
      expect(() => verifyRefreshToken('bad.token')).toThrow();
    });
  });

  describe('cross-secret verification', () => {
    it('access token cannot be verified with refresh secret', () => {
      const accessToken = generateAccessToken(payload);
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
