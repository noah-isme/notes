import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { googleConnections, type GoogleConnection } from '$lib/server/db/schema';
import { refreshAccessToken, type GoogleTokenResponse } from './auth';

/**
 * Fetches the Google Drive connection row for a user, if any.
 */
export async function getGoogleConnection(userId: string): Promise<GoogleConnection | null> {
  const [connection] = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.userId, userId));
  return connection ?? null;
}

/**
 * Returns a currently-valid Google access token for the user, refreshing it
 * from the stored refresh token when it is within 60s of expiry. Returns null
 * when no usable token is available; a failed refresh deletes the connection.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const connection = await getGoogleConnection(userId);
  if (!connection) {
    return null;
  }

  if (connection.expiresAt.getTime() - 60_000 > Date.now()) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    return null;
  }

  let refreshed: GoogleTokenResponse;
  try {
    refreshed = await refreshAccessToken(connection.refreshToken);
  } catch {
    await deleteGoogleConnection(userId);
    return null;
  }

  await db
    .update(googleConnections)
    .set({
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      ...(refreshed.scope !== undefined ? { scope: refreshed.scope } : {}),
      updatedAt: new Date(),
    })
    .where(eq(googleConnections.userId, userId));

  return refreshed.accessToken;
}

/**
 * Upserts the Google Drive connection for a user. When no new refreshToken is
 * provided, the existing one is preserved on update.
 */
export async function saveGoogleConnection(
  userId: string,
  data: {
    googleSub: string;
    email: string | null;
    accessToken: string;
    expiresIn: number;
    refreshToken?: string;
    scope?: string;
  }
): Promise<GoogleConnection> {
  const expiresAt = new Date(Date.now() + data.expiresIn * 1000);
  const existingConnection =
    data.refreshToken === undefined ? await getGoogleConnection(userId) : null;
  const refreshToken = data.refreshToken ?? existingConnection?.refreshToken ?? null;

  const [saved] = await db
    .insert(googleConnections)
    .values({
      userId,
      googleSub: data.googleSub,
      email: data.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      expiresAt,
      scope: data.scope ?? null,
    })
    .onConflictDoUpdate({
      target: googleConnections.userId,
      set: {
        accessToken: data.accessToken,
        refreshToken,
        expiresAt,
        scope: data.scope ?? null,
        googleSub: data.googleSub,
        email: data.email,
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

/**
 * Deletes the Google Drive connection for a user.
 */
export async function deleteGoogleConnection(userId: string): Promise<void> {
  await db.delete(googleConnections).where(eq(googleConnections.userId, userId));
}
