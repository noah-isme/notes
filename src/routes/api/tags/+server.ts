import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserTags, createTag, deleteTag } from '$lib/server/notes';
import { validateTagName } from '$lib/utils/validation';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tags = await getUserTags(locals.user.id);
    return json(tags, { status: 200 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to fetch tags' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body.name !== 'string' || !validateTagName(body.name)) {
    return json(
      {
        error:
          'Invalid tag name: must be 1-50 alphanumeric characters, hyphens or underscores',
      },
      { status: 400 }
    );
  }

  try {
    const tag = await createTag(locals.user.id, body.name);
    return json(tag, { status: 201 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to create tag' }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async ({ locals, url, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tagId = url.searchParams.get('id');

  if (!tagId) {
    try {
      const body = await request.json();
      if (body && typeof body.id === 'string') {
        tagId = body.id;
      }
    } catch {
      // Body not provided or not JSON, continue
    }
  }

  if (!tagId) {
    return json({ error: 'Tag ID is required' }, { status: 400 });
  }

  try {
    const deleted = await deleteTag(locals.user.id, tagId);
    if (!deleted) {
      return json({ error: 'Tag not found' }, { status: 404 });
    }
    return json({ success: true }, { status: 200 });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to delete tag' }, { status: 500 });
  }
};
