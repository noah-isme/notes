import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserById,
  updateUserProfile,
  updateUserPassword,
  verifyPassword,
} from '$lib/server/auth';
import { load as profileLoad, actions as profileActions } from '../../src/routes/(app)/profile/+page.server';
import { cleanDatabase, createTestUser, createTestNote, createTestTag } from '../helpers/db';

describe('Integration: User Profile Management & Settings', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('1. Direct Auth Service Profile Methods', () => {
    it('should retrieve user profile including display name and email', async () => {
      const { user } = await createTestUser({ email: 'profile_test@example.com' });
      const fetched = await getUserById(user.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(user.id);
      expect(fetched?.email).toBe('profile_test@example.com');
    });

    it('should update user display name and email', async () => {
      const { user } = await createTestUser({ email: 'original@example.com' });
      const result = await updateUserProfile(user.id, {
        name: 'Jane Doe',
        email: 'updated@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.user?.name).toBe('Jane Doe');
      expect(result.user?.email).toBe('updated@example.com');

      const refreshed = await getUserById(user.id);
      expect(refreshed?.name).toBe('Jane Doe');
      expect(refreshed?.email).toBe('updated@example.com');
    });

    it('should reject email update if another user already owns that email', async () => {
      const { user: user1 } = await createTestUser({ email: 'user1@example.com' });
      const { user: user2 } = await createTestUser({ email: 'user2@example.com' });

      const result = await updateUserProfile(user2.id, {
        email: 'user1@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already in use');

      const user2Check = await getUserById(user2.id);
      expect(user2Check?.email).toBe('user2@example.com');
    });

    it('should allow updating password when current password is correct', async () => {
      const { user, rawPassword } = await createTestUser();
      const newPassword = 'BrandNewPassword2026!';

      const result = await updateUserPassword(user.id, rawPassword, newPassword);
      expect(result.success).toBe(true);

      const updatedUser = await getUserById(user.id);
      const isNewValid = await verifyPassword(newPassword, updatedUser!.passwordHash);
      const isOldValid = await verifyPassword(rawPassword, updatedUser!.passwordHash);

      expect(isNewValid).toBe(true);
      expect(isOldValid).toBe(false);
    });

    it('should reject password update when current password is incorrect', async () => {
      const { user } = await createTestUser();
      const result = await updateUserPassword(
        user.id,
        'WrongCurrentPassword123!',
        'NewPassword456!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Current password is incorrect');
    });
  });

  describe('2. Profile Page Server Load & Form Actions', () => {
    it('should load profile details and note/tag stats for authenticated user', async () => {
      const { user } = await createTestUser({ email: 'stats_test@example.com' });
      await createTestNote(user.id, { title: 'Note 1' });
      await createTestNote(user.id, { title: 'Note 2' });
      await createTestTag(user.id, 'tag1');

      const event: any = {
        locals: { user: { id: user.id, email: user.email }, session: null },
      };

      const data: any = await profileLoad(event);
      expect(data.profile.email).toBe('stats_test@example.com');
      expect(data.stats.notesCount).toBe(2);
      expect(data.stats.tagsCount).toBe(1);
    });

    it('should handle updateProfile action via form data', async () => {
      const { user } = await createTestUser({ email: 'form_test@example.com' });
      const formData = new FormData();
      formData.append('name', 'Alex Smith');
      formData.append('email', 'alex.smith@example.com');

      const event: any = {
        request: { formData: async () => formData },
        locals: { user: { id: user.id, email: user.email }, session: null },
      };

      const result: any = await profileActions.updateProfile(event);
      expect(result.profileSuccess).toBe(true);

      const updated = await getUserById(user.id);
      expect(updated?.name).toBe('Alex Smith');
      expect(updated?.email).toBe('alex.smith@example.com');
    });

    it('should handle updatePassword action via form data', async () => {
      const { user, rawPassword } = await createTestUser();
      const formData = new FormData();
      formData.append('currentPassword', rawPassword);
      formData.append('newPassword', 'SecurePassword999!');
      formData.append('confirmPassword', 'SecurePassword999!');

      const event: any = {
        request: { formData: async () => formData },
        locals: { user: { id: user.id, email: user.email }, session: null },
      };

      const result: any = await profileActions.updatePassword(event);
      expect(result.passwordSuccess).toBe(true);

      const updatedUser = await getUserById(user.id);
      expect(await verifyPassword('SecurePassword999!', updatedUser!.passwordHash)).toBe(true);
    });

    it('should reject updatePassword when confirmPassword does not match', async () => {
      const { user, rawPassword } = await createTestUser();
      const formData = new FormData();
      formData.append('currentPassword', rawPassword);
      formData.append('newPassword', 'PasswordA123!');
      formData.append('confirmPassword', 'PasswordB123!');

      const event: any = {
        request: { formData: async () => formData },
        locals: { user: { id: user.id, email: user.email }, session: null },
      };

      const result: any = await profileActions.updatePassword(event);
      expect(result.status).toBe(400);
      expect(result.data.passwordError).toContain('do not match');
    });
  });
});
