import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getNoteById,
  enableShare,
  disableShare,
  regenerateShareToken,
} from '$lib/server/notes';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  try {
    const note = await getNoteById(locals.user.id, id);
    if (!note) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    const origin = url.origin;
    const shareUrl =
      note.shareToken && note.isPublic
        ? `${origin}/share/${note.shareToken}`
        : null;

    return json(
      {
        id: note.id,
        isPublic: note.isPublic,
        shareToken: note.shareToken,
        shareUrl,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return json(
      { error: err?.message || 'Failed to fetch share status' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {}

  try {
    const action = body?.action || url.searchParams.get('action');
    let updated;
    if (action === 'regenerate') {
      updated = await regenerateShareToken(locals.user.id, id);
    } else if (action === 'disable') {
      updated = await disableShare(locals.user.id, id);
    } else {
      updated = await enableShare(locals.user.id, id);
    }

    if (!updated) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    const origin = url.origin;
    const shareUrl =
      updated.shareToken && updated.isPublic
        ? `${origin}/share/${updated.shareToken}`
        : null;

    return json(
      {
        id: updated.id,
        isPublic: updated.isPublic,
        shareToken: updated.shareToken,
        shareUrl,
        note: updated,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return json(
      { error: err?.message || 'Failed to update share status' },
      { status: 500 }
    );
  }
};

export const PATCH: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  try {
    const updated = await regenerateShareToken(locals.user.id, id);
    if (!updated) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    const origin = url.origin;
    const shareUrl =
      updated.shareToken && updated.isPublic
        ? `${origin}/share/${updated.shareToken}`
        : null;

    return json(
      {
        id: updated.id,
        isPublic: updated.isPublic,
        shareToken: updated.shareToken,
        shareUrl,
        note: updated,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return json(
      { error: err?.message || 'Failed to regenerate share token' },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return json({ error: 'Note ID is required' }, { status: 400 });
  }

  try {
    const updated = await disableShare(locals.user.id, id);
    if (!updated) {
      return json({ error: 'Note not found' }, { status: 404 });
    }

    return json(
      {
        id: updated.id,
        isPublic: false,
        shareToken: updated.shareToken,
        shareUrl: null,
        note: updated,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return json(
      { error: err?.message || 'Failed to disable share' },
      { status: 500 }
    );
  }
};
