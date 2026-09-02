import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getUserById, updateUserProfile, updateUserPassword } from '$lib/server/auth';
import { validateEmail, validatePassword, validateDisplayName } from '$lib/utils/validation';
import { db } from '$lib/server/db';
import { notes, tags } from '$lib/server/db/schema';
import { eq, count } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const user = await getUserById(locals.user.id);
  if (!user) {
    throw redirect(302, '/login');
  }

  const [notesCountResult] = await db
    .select({ count: count() })
    .from(notes)
    .where(eq(notes.userId, user.id));

  const [tagsCountResult] = await db
    .select({ count: count() })
    .from(tags)
    .where(eq(tags.userId, user.id));

  return {
    profile: {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    stats: {
      notesCount: notesCountResult?.count ?? 0,
      tagsCount: tagsCountResult?.count ?? 0,
    },
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }

    const formData = await request.formData();
    const name = formData.get('name')?.toString() ?? '';
    const email = formData.get('email')?.toString() ?? '';

    if (!validateEmail(email)) {
      return fail(400, {
        profileError: 'Please provide a valid email address.',
        values: { name, email },
      });
    }

    if (!validateDisplayName(name)) {
      return fail(400, {
        profileError: 'Display name cannot exceed 100 characters.',
        values: { name, email },
      });
    }

    const result = await updateUserProfile(locals.user.id, {
      name: name.trim() || null,
      email: email.trim(),
    });

    if (!result.success || !result.user) {
      return fail(400, {
        profileError: result.error || 'Failed to update profile.',
        values: { name, email },
      });
    }

    // Update session locals representation
    locals.user.email = result.user.email;
    locals.user.name = result.user.name;

    return {
      profileSuccess: true,
      profileMessage: 'Your profile has been updated successfully!',
    };
  },

  updatePassword: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Unauthorized' });
    }

    const formData = await request.formData();
    const currentPassword = formData.get('currentPassword')?.toString() ?? '';
    const newPassword = formData.get('newPassword')?.toString() ?? '';
    const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

    if (!currentPassword) {
      return fail(400, {
        passwordError: 'Please enter your current password.',
      });
    }

    if (!validatePassword(newPassword)) {
      return fail(400, {
        passwordError: 'New password must be at least 6 characters long.',
      });
    }

    if (newPassword !== confirmPassword) {
      return fail(400, {
        passwordError: 'New passwords do not match.',
      });
    }

    const result = await updateUserPassword(
      locals.user.id,
      currentPassword,
      newPassword
    );

    if (!result.success) {
      return fail(400, {
        passwordError: result.error || 'Failed to update password.',
      });
    }

    return {
      passwordSuccess: true,
      passwordMessage: 'Your password has been changed successfully!',
    };
  },
};
