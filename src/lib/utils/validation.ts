/**
 * Input validation utilities and schemas for users, authentication, notes, and tags.
 */

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const TAG_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates email format according to RFC rules.
 */
export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Validates password length and structure (minimum 6 characters, maximum 255 characters, not whitespace-only).
 */
export function validatePassword(password: unknown): boolean {
  if (typeof password !== 'string') return false;
  if (password.trim().length === 0) return false;
  return password.length >= 6 && password.length <= 255;
}

/**
 * Validates display name: optional or string up to 100 characters.
 */
export function validateDisplayName(name: unknown): boolean {
  if (name === null || name === undefined || name === '') return true;
  if (typeof name !== 'string') return false;
  return name.trim().length <= 100;
}

export interface NoteInput {
  title?: unknown;
  content?: unknown;
  isPinned?: unknown;
  tagNames?: unknown;
}

/**
 * Validates note creation or update input.
 * Title must be a non-empty string between 1 and 200 characters.
 */
export function validateNoteInput(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const { title, content } = input as NoteInput;

  if (typeof title !== 'string') return false;
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0 || title.length > 200) return false;

  if (content !== undefined && typeof content !== 'string') return false;

  return true;
}

export const validateNote = validateNoteInput;

/**
 * Validates tag name: 1-50 characters, alphanumeric, hyphens, and underscores only.
 */
export function validateTagName(name: unknown): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return false;
  return TAG_REGEX.test(trimmed);
}

export const validateTag = validateTagName;
