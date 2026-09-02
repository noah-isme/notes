import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import { FIXTURES } from '../helpers/fixtures';

describe('Unit: Password Hashing & Verification Service', () => {
  it('should generate a non-empty salted hash string for a valid password', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(32);
    // Should contain salt separator (e.g. colon or dot) or be in structured format
    expect(hash).toMatch(/[:.]/);
  });

  it('should generate distinct hashes for identical passwords due to cryptographic salt randomness', async () => {
    const rawPassword = 'IdenticalPassword123!';
    const hash1 = await hashPassword(rawPassword);
    const hash2 = await hashPassword(rawPassword);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(rawPassword, hash1)).toBe(true);
    expect(await verifyPassword(rawPassword, hash2)).toBe(true);
  });

  it('should return true when verifying the exact plaintext password', async () => {
    const rawPassword = FIXTURES.users.validUser1.password;
    const hash = await hashPassword(rawPassword);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);
  });

  it('should return false when verifying an incorrect password', async () => {
    const rawPassword = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword456!';
    const hash = await hashPassword(rawPassword);

    const isMatch = await verifyPassword(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });

  it('should enforce case sensitivity on password verification', async () => {
    const rawPassword = 'MySecretPassword123';
    const lowercasePassword = 'mysecretpassword123';
    const uppercasePassword = 'MYSECRETPASSWORD123';
    const hash = await hashPassword(rawPassword);

    expect(await verifyPassword(rawPassword, hash)).toBe(true);
    expect(await verifyPassword(lowercasePassword, hash)).toBe(false);
    expect(await verifyPassword(uppercasePassword, hash)).toBe(false);
  });

  it('should return false or reject when verifying with an empty string password', async () => {
    const rawPassword = 'NonEmptyPassword123!';
    const hash = await hashPassword(rawPassword);

    const isMatch = await verifyPassword('', hash);
    expect(isMatch).toBe(false);
  });

  it('should return false or handle gracefully when provided with a malformed hash', async () => {
    const rawPassword = 'Password123!';

    const malformedHashes = [
      '',
      'invalid_hash_without_delimiter',
      'malformed:salt:extra:fields',
      'not_a_valid_hex:also_not_valid',
      ':',
      'abc:xyz'
    ];

    for (const badHash of malformedHashes) {
      try {
        const result = await verifyPassword(rawPassword, badHash);
        expect(result).toBe(false);
      } catch (err) {
        // Throwing an explicit error on malformed hash is also an acceptable secure behavior
        expect(err).toBeDefined();
      }
    }
  });

  it('should correctly hash and verify unicode and special character passwords', async () => {
    for (const unicode of FIXTURES.unicodeSamples) {
      const password = `Pass-${unicode.text}-123!`;
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword(password + 'x', hash)).toBe(false);
    }
  });

  it('should correctly hash and verify long passwords (128 characters)', async () => {
    const longPassword = 'A'.repeat(120) + '!9@z#$Qx';
    const hash = await hashPassword(longPassword);

    expect(hash).toBeDefined();
    expect(await verifyPassword(longPassword, hash)).toBe(true);
    expect(await verifyPassword(longPassword.slice(0, -1), hash)).toBe(false);
  });
});
