// test/auth.service.test.ts
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
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  InvalidCredentialsError,
  InactiveUserError,
  InvalidTokenError,
} from '../src/services/auth.service';

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
        },
      });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
        include: { roles: true },
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
      // Assuming blacklist is stored in Redis or database
      // Mock the blacklist add operation
      prismaMock.$executeRaw.mockResolvedValue(1 as never);

      await logout('valid_token');

      // Verify token was blacklisted
      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken()', () => {
    const mockPayload = {
      userId: 1,
      email: 'john@example.com',
      type: 'refresh',
    };

    it('should return new access token for valid refresh token', async () => {
      jwtMock.verify.mockReturnValue(mockPayload as never);
      jwtMock.sign.mockReturnValue('new_access_token' as never);

      // Mock blacklist check - token not blacklisted
      prismaMock.$queryRaw.mockResolvedValue([] as never);

      const result = await refreshAccessToken('valid_refresh_token');

      expect(result).toEqual({
        accessToken: 'new_access_token',
      });
      expect(jwtMock.verify).toHaveBeenCalledWith(
        'valid_refresh_token',
        expect.any(String),
      );
    });

    it('should throw InvalidTokenError for blacklisted token', async () => {
      jwtMock.verify.mockReturnValue(mockPayload as never);

      // Mock blacklist check - token is blacklisted
      prismaMock.$queryRaw.mockResolvedValue([{ token: 'valid_refresh_token' }] as never);

      await expect(refreshAccessToken('valid_refresh_token')).rejects.toThrow(
        InvalidTokenError,
      );
    });

    it('should throw InvalidTokenError for expired token', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await expect(refreshAccessToken('expired_token')).rejects.toThrow(
        InvalidTokenError,
      );
    });

    it('should throw InvalidTokenError for invalid token signature', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid signature');
      });

      await expect(refreshAccessToken('invalid_token')).rejects.toThrow(
        InvalidTokenError,
      );
    });
  });

  describe('generateAccessToken()', () => {
    it('should generate access token with correct payload', () => {
      jwtMock.sign.mockReturnValue('access_token' as never);

      const user = {
        id: 1,
        email: 'john@example.com',
        name: 'john_doe',
        roles: [{ name: 'user' }],
      };

      generateAccessToken(user);

      expect(jwtMock.sign).toHaveBeenCalledWith(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          roles: ['user'],
          type: 'access',
        },
        expect.any(String),
        { expiresIn: '15m' }, // Short-lived access token
      );
    });
  });

  describe('generateRefreshToken()', () => {
    it('should generate refresh token with correct payload', () => {
      jwtMock.sign.mockReturnValue('refresh_token' as never);

      const user = {
        id: 1,
        email: 'john@example.com',
      };

      generateRefreshToken(user);

      expect(jwtMock.sign).toHaveBeenCalledWith(
        {
          userId: user.id,
          email: user.email,
          type: 'refresh',
        },
        expect.any(String),
        { expiresIn: '7d' }, // Long-lived refresh token
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
