// test/auth.service.test.ts
// Set up environment variables before importing anything
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.DEPLOY_KEY = 'test-deploy-key';

jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// NOTE: These tests are written for auth service that should be implemented
// If auth.service.ts doesn't exist yet, these tests will fail until implemented
import {
  login,
  logout,
  refreshAccessToken,
  InvalidCredentialsError,
  InactiveUserError,
} from '../src/services/auth.service';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  InvalidTokenError,
} from '../src/lib/tokens';

describe('Auth Service', () => {
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;
  const jwtMock = jwt as jest.Mocked<typeof jwt>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login()', () => {
    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      password: '$2b$10$hashedpassword',
      active: true,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return tokens for valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(validUser);
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtMock.sign.mockReturnValueOnce('access_token_mock' as never);
      jwtMock.sign.mockReturnValueOnce('refresh_token_mock' as never);

      const result = await login('john@example.com', 'password123');

      expect(result).toEqual({
        accessToken: 'access_token_mock',
        refreshToken: 'refresh_token_mock',
        user: {
          id: validUser.id,
          email: validUser.email,
          name: validUser.name,
          active: validUser.active,
          confirmedAt: validUser.confirmedAt,
          createdAt: validUser.createdAt,
          updatedAt: validUser.updatedAt,
        },
      });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          active: true,
        },
      });
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'password123',
        validUser.password,
      );
    });

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(login('nonexistent@example.com', 'password123')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(validUser);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(login('john@example.com', 'wrongpassword')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });

    it('should throw InactiveUserError for inactive user', async () => {
      const inactiveUser = { ...validUser, active: false };
      prismaMock.user.findUnique.mockResolvedValue(inactiveUser);
      bcryptMock.compare.mockResolvedValue(true as never);

      await expect(login('john@example.com', 'password123')).rejects.toThrow(
        InactiveUserError,
      );
    });
  });

  describe('logout()', () => {
    it('should add token to blacklist', async () => {
      // Mock JWT verify to allow token validation
      jwtMock.verify.mockReturnValue({
        userId: 1,
        email: 'john@example.com',
        type: 'refresh',
      } as never);

      const result = await logout('valid_refresh_token');

      // Verify logout was successful
      expect(result).toBe(true);
      expect(jwtMock.verify).toHaveBeenCalledWith('valid_refresh_token', expect.any(String));
    });
  });

  describe('refreshAccessToken()', () => {
    const mockPayload = {
      userId: 1,
      email: 'john@example.com',
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      active: true,
    };

    it('should return new access token for valid refresh token', async () => {
      const uniqueRefreshToken = 'valid_refresh_token_unique_12345';
      jwtMock.verify.mockReturnValue(mockPayload as never);
      jwtMock.sign.mockReturnValue('new_access_token' as never);
      prismaMock.user.findUnique.mockResolvedValue(validUser as never);
      prismaMock.$queryRaw.mockResolvedValue([] as never); // Not blacklisted

      const result = await refreshAccessToken(uniqueRefreshToken);

      expect(result).toBe('new_access_token');
      expect(jwtMock.verify).toHaveBeenCalledWith(
        uniqueRefreshToken,
        expect.any(String),
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, email: true, active: true },
      });
    });

    it('should throw TokenBlacklistedError for blacklisted token', async () => {
      // First logout with the token to blacklist it
      jwtMock.verify.mockReturnValue(mockPayload as never);
      await logout('blacklisted_token');

      // Now try to refresh with the blacklisted token
      await expect(refreshAccessToken('blacklisted_token')).rejects.toThrow(
        'Token has been revoked',
      );
    });

    it('should throw TokenExpiredError for expired token', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await expect(refreshAccessToken('expired_token')).rejects.toThrow(
        'Token has expired',
      );
    });

    it('should throw InvalidTokenError for invalid token signature', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid signature');
      });

      await expect(refreshAccessToken('invalid_token')).rejects.toThrow(
        'Invalid token',
      );
    });
  });

  describe('generateAccessToken()', () => {
    it('should generate access token with correct payload', () => {
      jwtMock.sign.mockReturnValue('access_token' as never);

      const userId = 1;
      const email = 'john@example.com';

      generateAccessToken(userId, email);

      expect(jwtMock.sign).toHaveBeenCalledWith(
        {
          userId,
          email,
          type: 'access',
        },
        expect.any(String),
        { expiresIn: expect.any(String) }, // Access token expiry from config
      );
    });
  });

  describe('generateRefreshToken()', () => {
    it('should generate refresh token with correct payload', () => {
      jwtMock.sign.mockReturnValue('refresh_token' as never);

      const userId = 1;
      const email = 'john@example.com';

      generateRefreshToken(userId, email);

      expect(jwtMock.sign).toHaveBeenCalledWith(
        {
          userId,
          email,
          type: 'refresh',
        },
        expect.any(String),
        { expiresIn: expect.any(String) }, // Refresh token expiry from config
      );
    });
  });

  describe('verifyToken()', () => {
    it('should return decoded payload for valid token', () => {
      const mockPayload = {
        userId: 1,
        email: 'john@example.com',
        type: 'access',
      };
      jwtMock.verify.mockReturnValue(mockPayload as never);

      const result = verifyToken('valid_token');

      expect(result).toEqual(mockPayload);
      expect(jwtMock.verify).toHaveBeenCalledWith(
        'valid_token',
        expect.any(String),
      );
    });

    it('should throw InvalidTokenError for invalid token', () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      expect(() => verifyToken('invalid_token')).toThrow(InvalidTokenError);
    });
  });
});
