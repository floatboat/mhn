/**
 * Unit tests for credential utilities
 *
 * Tests HPFeeds secret generation and validation functions.
 */

import {
  generateHPFeedsSecret,
  isValidHPFeedsSecret,
  isValidUUIDv1,
  isValidUUID,
  isValidHoneypotType,
} from '../src/lib/credentials';

describe('Credential Utilities', () => {
  describe('generateHPFeedsSecret', () => {
    it('should generate a 40-character hex string', () => {
      const secret = generateHPFeedsSecret();

      expect(secret).toHaveLength(40);
      expect(/^[a-f0-9]{40}$/.test(secret)).toBe(true);
    });

    it('should generate unique secrets', () => {
      const secret1 = generateHPFeedsSecret();
      const secret2 = generateHPFeedsSecret();
      const secret3 = generateHPFeedsSecret();

      expect(secret1).not.toBe(secret2);
      expect(secret2).not.toBe(secret3);
      expect(secret1).not.toBe(secret3);
    });

    it('should generate cryptographically secure secrets', () => {
      // Generate multiple secrets and check they're all different
      const secrets = new Set();
      for (let i = 0; i < 100; i++) {
        secrets.add(generateHPFeedsSecret());
      }

      // All 100 should be unique (collision extremely unlikely with crypto random)
      expect(secrets.size).toBe(100);
    });
  });

  describe('isValidHPFeedsSecret', () => {
    it('should validate correct 40-char hex secret', () => {
      const validSecret = 'a1b2c3d4e5f6789012345678901234567890abcd';
      expect(isValidHPFeedsSecret(validSecret)).toBe(true);
    });

    it('should accept lowercase hex only', () => {
      const lowercaseSecret = 'abcdef0123456789abcdef0123456789abcdef01';
      expect(isValidHPFeedsSecret(lowercaseSecret)).toBe(true);
    });

    it('should reject uppercase hex characters', () => {
      const uppercaseSecret = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
      expect(isValidHPFeedsSecret(uppercaseSecret)).toBe(false);
    });

    it('should reject mixed case hex', () => {
      const mixedSecret = 'AbCdEf0123456789AbCdEf0123456789AbCdEf01';
      expect(isValidHPFeedsSecret(mixedSecret)).toBe(false);
    });

    it('should reject secrets that are too short', () => {
      const shortSecret = 'a1b2c3d4e5f6789012345678901234567890abc';
      expect(isValidHPFeedsSecret(shortSecret)).toBe(false);
    });

    it('should reject secrets that are too long', () => {
      const longSecret = 'a1b2c3d4e5f6789012345678901234567890abcde';
      expect(isValidHPFeedsSecret(longSecret)).toBe(false);
    });

    it('should reject non-hex characters', () => {
      const invalidSecret = 'g1b2c3d4e5f6789012345678901234567890abcd'; // 'g' is not hex
      expect(isValidHPFeedsSecret(invalidSecret)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidHPFeedsSecret('')).toBe(false);
    });

    it('should reject secrets with special characters', () => {
      const specialSecret = 'a1b2c3d4-5f6789012345678901234567890abcd';
      expect(isValidHPFeedsSecret(specialSecret)).toBe(false);
    });

    it('should validate generated secrets', () => {
      const generated = generateHPFeedsSecret();
      expect(isValidHPFeedsSecret(generated)).toBe(true);
    });
  });

  describe('isValidUUIDv1', () => {
    it('should validate correct UUID v1', () => {
      const validUuid = '550e8400-e29b-11d4-a716-446655440000';
      expect(isValidUUIDv1(validUuid)).toBe(true);
    });

    it('should validate UUID v1 with version bit 1', () => {
      const validUuid = '12345678-1234-1234-9234-123456789012';
      expect(isValidUUIDv1(validUuid)).toBe(true);
    });

    it('should reject UUID v4 (version bit 4)', () => {
      const uuidV4 = '123e4567-e89b-42d3-a456-426614174000'; // v4
      expect(isValidUUIDv1(uuidV4)).toBe(false);
    });

    it('should reject UUID with wrong version', () => {
      const wrongVersion = '550e8400-e29b-21d4-a716-446655440000'; // version 2
      expect(isValidUUIDv1(wrongVersion)).toBe(false);
    });

    it('should reject invalid variant bits', () => {
      const invalidVariant = '550e8400-e29b-11d4-0716-446655440000'; // variant bits wrong
      expect(isValidUUIDv1(invalidVariant)).toBe(false);
    });

    it('should reject malformed UUID', () => {
      const malformed = '550e8400-e29b-11d4-a716-4466554400';
      expect(isValidUUIDv1(malformed)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidUUIDv1('')).toBe(false);
    });

    it('should reject uppercase UUID', () => {
      const uppercase = '550E8400-E29B-11D4-A716-446655440000';
      expect(isValidUUIDv1(uppercase)).toBe(false);
    });

    it('should reject UUID without dashes', () => {
      const noDashes = '550e8400e29b11d4a716446655440000';
      expect(isValidUUIDv1(noDashes)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate UUID v1', () => {
      const uuidV1 = '550e8400-e29b-11d4-a716-446655440000';
      expect(isValidUUID(uuidV1)).toBe(true);
    });

    it('should validate UUID v4', () => {
      const uuidV4 = '123e4567-e89b-42d3-a456-426614174000';
      expect(isValidUUID(uuidV4)).toBe(true);
    });

    it('should validate any UUID version', () => {
      const uuidV2 = '550e8400-e29b-21d4-a716-446655440000';
      expect(isValidUUID(uuidV2)).toBe(true);
    });

    it('should reject malformed UUID', () => {
      const malformed = '550e8400-e29b-11d4-a716-4466554400';
      expect(isValidUUID(malformed)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should reject non-UUID string', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });
  });

  describe('isValidHoneypotType', () => {
    const validTypes = [
      'dionaea',
      'cowrie',
      'conpot',
      'glastopf',
      'kippo',
      'wordpot',
      'shockpot',
      'p0f',
    ];

    validTypes.forEach((type) => {
      it(`should validate ${type}`, () => {
        expect(isValidHoneypotType(type)).toBe(true);
      });
    });

    it('should reject invalid honeypot type', () => {
      expect(isValidHoneypotType('invalid')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidHoneypotType('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isValidHoneypotType('Dionaea')).toBe(false);
      expect(isValidHoneypotType('DIONAEA')).toBe(false);
    });

    it('should reject honeypot type with extra spaces', () => {
      expect(isValidHoneypotType(' dionaea')).toBe(false);
      expect(isValidHoneypotType('dionaea ')).toBe(false);
    });
  });
});
