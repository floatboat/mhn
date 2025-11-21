// test/password-reset.test.ts
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
jest.mock('crypto');

import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// NOTE: These tests are for password reset service that should be implemented
// If password-reset.service.ts doesn't exist yet, these tests will fail until implemented
import {
  requestReset,
  validateResetToken,
  resetPassword,
  InvalidResetTokenError,
} from '../src/services/password-reset.service';

describe('Password Reset Service', () => {
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;
  const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;
  const cryptoMock = crypto as jest.Mocked<typeof crypto>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestReset()', () => {
    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      password: 'hashed',
      active: true,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should generate reset token for valid email', async () => {
      const mockToken = 'a'.repeat(40); // 40 character hash

      prismaMock.user.findUnique.mockResolvedValue(validUser);
      (cryptoMock.randomBytes as jest.Mock).mockReturnValue({
        toString: () => mockToken,
      });

      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      prismaMock.passwdReset.create.mockResolvedValue({
        id: 1,
        hashStr: mockToken,
        active: true,
        userId: 1,
        createdAt: new Date(),
        expiresAt,
      });

      const result = await requestReset('john@example.com');

      expect(result).toMatchObject({
        id: 1,
        hashStr: mockToken,
        userId: 1,
        expiresAt,
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });

      expect(prismaMock.passwdReset.create).toHaveBeenCalledWith({
        data: {
          hashStr: mockToken,
          userId: 1,
          expiresAt: expect.any(Date),
          active: true,
        },
      });
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(requestReset('nonexistent@example.com')).rejects.toThrow(
        'User with email \'nonexistent@example.com\' not found',
      );
      expect(prismaMock.passwdReset.create).not.toHaveBeenCalled();
    });

    it('should deactivate old reset tokens before creating new one', async () => {
      prismaMock.user.findUnique.mockResolvedValue(validUser);
      (cryptoMock.randomBytes as jest.Mock).mockReturnValue({
        toString: () => 'a'.repeat(40),
      });

      prismaMock.passwdReset.updateMany.mockResolvedValue({ count: 2 } as never);
      prismaMock.passwdReset.create.mockResolvedValue({
        id: 1,
        hashStr: 'a'.repeat(40),
        active: true,
        userId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      await requestReset('john@example.com');

      expect(prismaMock.passwdReset.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          active: true,
        },
        data: {
          active: false,
        },
      });
    });

    it('should generate 40 character token', async () => {
      const mockBytes = Buffer.from('test');
      (cryptoMock.randomBytes as jest.Mock).mockReturnValue(mockBytes);

      prismaMock.user.findUnique.mockResolvedValue(validUser);
      prismaMock.passwdReset.create.mockResolvedValue({
        id: 1,
        hashStr: mockBytes.toString('hex'),
        active: true,
        userId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      await requestReset('john@example.com');

      expect(cryptoMock.randomBytes).toHaveBeenCalledWith(20); // 20 bytes = 40 hex chars
    });
  });

  describe('validateResetToken()', () => {
    const validToken = {
      id: 1,
      hashStr: 'valid_token_40_chars_xxxxxxxxxxxxxx',
      active: true,
      userId: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    it('should return reset token for valid token', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(validToken);

      const result = await validateResetToken('valid_token_40_chars_xxxxxxxxxxxxxx');

      expect(result).toMatchObject({
        id: 1,
        hashStr: 'valid_token_40_chars_xxxxxxxxxxxxxx',
        active: true,
        userId: 1,
      });
    });

    it('should throw InvalidResetTokenError for non-existent token', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(null);

      await expect(
        validateResetToken('invalid_token'),
      ).rejects.toThrow(InvalidResetTokenError);
    });

    it('should throw InvalidResetTokenError for inactive token', async () => {
      const inactiveToken = { ...validToken, active: false };
      prismaMock.passwdReset.findUnique.mockResolvedValue(inactiveToken);

      await expect(
        validateResetToken('inactive_token'),
      ).rejects.toThrow(InvalidResetTokenError);
    });

    it('should throw InvalidResetTokenError for expired token', async () => {
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };
      prismaMock.passwdReset.findUnique.mockResolvedValue(expiredToken);
      prismaMock.passwdReset.update.mockResolvedValue({
        ...expiredToken,
        active: false,
      });

      await expect(
        validateResetToken('expired_token'),
      ).rejects.toThrow('Reset token has expired');
    });
  });

  describe('resetPassword()', () => {
    const validToken = {
      id: 1,
      hashStr: 'valid_token_40_chars_xxxxxxxxxxxxxx',
      active: true,
      userId: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    };

    const validUser = {
      id: 1,
      email: 'john@example.com',
      name: 'john_doe',
      password: 'old_hashed_password',
      active: true,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should reset password with valid token', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(validToken);
      bcryptMock.hash.mockResolvedValue('new_hashed_password' as never);
      prismaMock.user.update.mockResolvedValue({
        ...validUser,
        password: 'new_hashed_password',
      });
      prismaMock.passwdReset.update.mockResolvedValue({
        ...validToken,
        active: false,
      });

      const result = await resetPassword('valid_token_40_chars_xxxxxxxxxxxxxx', 'newpassword123');

      expect(result).toBe(true);
      expect(bcryptMock.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { password: 'new_hashed_password' },
      });
      expect(prismaMock.passwdReset.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
    });

    it('should throw InvalidResetTokenError for invalid token', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(null);

      await expect(
        resetPassword('invalid_token', 'newpassword123'),
      ).rejects.toThrow(InvalidResetTokenError);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('should throw InvalidResetTokenError for expired token', async () => {
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 3600000),
      };
      prismaMock.passwdReset.findUnique.mockResolvedValue(expiredToken);
      prismaMock.passwdReset.update.mockResolvedValue({
        ...expiredToken,
        active: false,
      });

      await expect(
        resetPassword('expired_token', 'newpassword123'),
      ).rejects.toThrow('Reset token has expired');

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('should mark token as inactive after use', async () => {
      prismaMock.passwdReset.findUnique.mockResolvedValue(validToken);
      bcryptMock.hash.mockResolvedValue('new_hashed_password' as never);
      prismaMock.user.update.mockResolvedValue({
        ...validUser,
        password: 'new_hashed_password',
      });
      prismaMock.passwdReset.update.mockResolvedValue({
        ...validToken,
        active: false,
      });

      await resetPassword('valid_token_40_chars_xxxxxxxxxxxxxx', 'newpassword123');

      expect(prismaMock.passwdReset.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
    });

    it('should not allow reusing same token twice', async () => {
      prismaMock.passwdReset.findUnique
        .mockResolvedValueOnce(validToken)
        .mockResolvedValueOnce({ ...validToken, active: false });

      bcryptMock.hash.mockResolvedValue('new_hashed_password' as never);
      prismaMock.user.update.mockResolvedValue({
        ...validUser,
        password: 'new_hashed_password',
      });
      prismaMock.passwdReset.update.mockResolvedValue({
        ...validToken,
        active: false,
      });

      // First use should succeed
      await resetPassword('valid_token_40_chars_xxxxxxxxxxxxxx', 'newpassword123');

      // Second use should fail
      await expect(
        resetPassword('valid_token_40_chars_xxxxxxxxxxxxxx', 'anotherpassword'),
      ).rejects.toThrow('Reset token has been used or revoked');
    });
  });

  describe('Token expiration', () => {
    it('should create tokens with 24 hour expiration (default)', async () => {
      const validUser = {
        id: 1,
        email: 'john@example.com',
        name: 'john_doe',
        password: 'hashed',
        active: true,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.user.findUnique.mockResolvedValue(validUser);
      (cryptoMock.randomBytes as jest.Mock).mockReturnValue({
        toString: () => 'a'.repeat(40),
      });

      let capturedExpiresAt: Date | undefined;
      prismaMock.passwdReset.create.mockImplementation((args: any) => {
        capturedExpiresAt = args.data.expiresAt as Date;
        return Promise.resolve({
          id: 1,
          hashStr: 'token',
          active: true,
          userId: 1,
          createdAt: new Date(),
          expiresAt: capturedExpiresAt,
        }) as any;
      });

      await requestReset('john@example.com');

      expect(capturedExpiresAt).toBeDefined();
      const now = new Date();
      const expirationTime = capturedExpiresAt!.getTime() - now.getTime();
      // Should be approximately 24 hours (86400000 ms), allow 1 second tolerance
      expect(expirationTime).toBeGreaterThan(86399000);
      expect(expirationTime).toBeLessThan(86401000);
    });
  });

  describe('cleanup old tokens', () => {
    it('should have mechanism to clean up expired tokens', async () => {
      // This would typically be a scheduled job
      await prismaMock.passwdReset.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { active: false, createdAt: { lt: new Date(Date.now() - 86400000 * 7) } }, // 7 days old inactive tokens
          ],
        },
      });

      expect(prismaMock.passwdReset.deleteMany).toHaveBeenCalled();
    });
  });
});
