export interface DriveUploadResult {
  id: string;
  webViewLink: string | null;
}

const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
const MULTIPART_BOUNDARY = 'notes-export-boundary';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Uploads a file to Google Drive via a multipart/related request and returns
 * the created file's id and webViewLink.
 */
export async function uploadFileToDrive(
  accessToken: string,
  filename: string,
  mimeType: string,
  content: Uint8Array
): Promise<DriveUploadResult> {
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${MULTIPART_BOUNDARY}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n' +
      '\r\n' +
      JSON.stringify({ name: filename }) +
      `\r\n--${MULTIPART_BOUNDARY}\r\n` +
      `Content-Type: ${mimeType}` +
      '\r\n\r\n'
  );
  const tail = encoder.encode(`\r\n--${MULTIPART_BOUNDARY}--`);

  const body = new Uint8Array(head.length + content.length + tail.length);
  body.set(head, 0);
  body.set(content, head.length);
  body.set(tail, head.length + content.length);

  let response: Response;
  try {
    response = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
      },
      body,
    });
  } catch {
    throw new Error('Google Drive upload failed');
  }

  if (!response.ok) {
    throw new Error('Google Drive upload failed');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!isRecord(data) || typeof data.id !== 'string') {
    throw new Error('Google Drive upload failed');
  }

  return {
    id: data.id,
    webViewLink: typeof data.webViewLink === 'string' ? data.webViewLink : null,
  };
}
