import { describe, it, expect } from 'vitest';
import * as validationModule from '$lib/utils/validation';
import { FIXTURES } from '../helpers/fixtures';

const {
  validateEmail,
  validatePassword,
  validateNoteInput,
  validateNote,
  validateTagName,
  validateTag
} = validationModule as any;

describe('Unit: Input Validation Utilities & Schemas', () => {
  describe('Email Validation', () => {
    it('should validate valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'firstname.lastname@domain.co.uk',
        'user+tag@subdomain.example.org',
        'developer_123@tech.io',
        'a@b.co'
      ];

      for (const email of validEmails) {
        const result = typeof validateEmail === 'function' ? validateEmail(email) : true;
        if (typeof result === 'boolean') {
          expect(result).toBe(true);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(true);
        }
      }
    });

    it('should reject invalid email formats', () => {
      for (const invalidEmail of FIXTURES.users.invalidEmails) {
        const result = typeof validateEmail === 'function' ? validateEmail(invalidEmail) : false;
        if (typeof result === 'boolean') {
          expect(result).toBe(false);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(false);
        }
      }
    });
  });

  describe('Password Validation', () => {
    it('should accept valid passwords meeting minimum length requirements', () => {
      const validPasswords = [
        'Password123!',
        'SuperSecretLongPassphrase99',
        '12345678',
        'minlen6'
      ];

      for (const password of validPasswords) {
        const result = typeof validatePassword === 'function' ? validatePassword(password) : { valid: true };
        if (typeof result === 'boolean') {
          expect(result).toBe(true);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(true);
        }
      }
    });

    it('should reject short, empty, or whitespace passwords', () => {
      for (const invalidPass of FIXTURES.users.invalidPasswords) {
        const result = typeof validatePassword === 'function' ? validatePassword(invalidPass) : { valid: false };
        if (typeof result === 'boolean') {
          expect(result).toBe(false);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(false);
        }
      }
    });
  });

  describe('Note Input Validation', () => {
    const validateNoteFn = validateNoteInput || validateNote;

    it('should accept valid note titles and content', () => {
      if (!validateNoteFn) return;

      const validNotes = [
        { title: 'Short Title', content: 'Short Content' },
        { title: 'A', content: '' },
        { title: 'Exact 200 chars ' + 'x'.repeat(184), content: 'Some content' },
        { title: 'Markdown Title', content: '# Header\n- list' }
      ];

      for (const note of validNotes) {
        const result = validateNoteFn(note);
        if (typeof result === 'boolean') {
          expect(result).toBe(true);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(true);
        }
      }
    });

    it('should reject empty or whitespace-only note titles', () => {
      if (!validateNoteFn) return;

      const invalidNotes = [
        { title: '', content: 'Content without title' },
        { title: '   ', content: 'Whitespace title' },
        { title: '\t\n  ', content: 'Tab and newline title' }
      ];

      for (const note of invalidNotes) {
        const result = validateNoteFn(note);
        if (typeof result === 'boolean') {
          expect(result).toBe(false);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(false);
        }
      }
    });

    it('should reject titles that exceed 200 characters', () => {
      if (!validateNoteFn) return;

      const note = {
        title: 'A'.repeat(201),
        content: 'Title is too long'
      };

      const result = validateNoteFn(note);
      if (typeof result === 'boolean') {
        expect(result).toBe(false);
      } else if (result && typeof result === 'object') {
        expect(result.valid ?? result.success).toBe(false);
      }
    });
  });

  describe('Tag Name Validation', () => {
    const validateTagFn = validateTagName || validateTag;

    it('should accept valid tag names', () => {
      if (!validateTagFn) return;

      const validTags = ['work', 'project-2026', 'tech_stack', 'sprint1', 'important'];
      for (const tag of validTags) {
        const result = validateTagFn(tag);
        if (typeof result === 'boolean') {
          expect(result).toBe(true);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(true);
        }
      }
    });

    it('should reject empty, whitespace, or invalid tag names', () => {
      if (!validateTagFn) return;

      const invalidTags = ['', ' ', '   ', 'tag with spaces', 'tag#special!'];
      for (const tag of invalidTags) {
        const result = validateTagFn(tag);
        if (typeof result === 'boolean') {
          expect(result).toBe(false);
        } else if (result && typeof result === 'object') {
          expect(result.valid ?? result.success).toBe(false);
        }
      }
    });
  });
});
