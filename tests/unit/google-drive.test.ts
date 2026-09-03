import { describe, it, expect, vi, afterEach } from 'vitest';

const { uploadFileToDrive } = (await import('$lib/server/google/drive')) as {
  uploadFileToDrive: (
    accessToken: string,
    filename: string,
    mimeType: string,
    content: Uint8Array
  ) => Promise<{ id: string; webViewLink: string | null }>;
};

const BOUNDARY = 'notes-export-boundary';

describe('Unit: Google Drive Upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a multipart/related request with metadata and content parts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'file-123', webViewLink: 'https://drive.google.com/file/d/file-123/view' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const content = new TextEncoder().encode('hello drive');
    const result = await uploadFileToDrive('token-abc', 'My Note.docx', 'text/plain', content);

    expect(result).toEqual({
      id: 'file-123',
      webViewLink: 'https://drive.google.com/file/d/file-123/view',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'
    );
    expect(String(init.method)).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-abc');
    expect(headers['Content-Type']).toBe(`multipart/related; boundary=${BOUNDARY}`);

    const body = init.body as Uint8Array;
    const decoded = new TextDecoder().decode(body);
    expect(decoded.startsWith(`--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`)).toBe(true);
    expect(decoded).toContain(JSON.stringify({ name: 'My Note.docx' }));
    expect(decoded).toContain(`Content-Type: text/plain\r\n\r\nhello drive`);
    expect(decoded.endsWith(`\r\n--${BOUNDARY}--`)).toBe(true);
    expect(body.length).toBeGreaterThan(content.length);
  });

  it('returns a null webViewLink when Drive omits it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'file-456' }),
      })
    );

    const result = await uploadFileToDrive('t', 'n.txt', 'text/plain', new Uint8Array([104, 105]));
    expect(result).toEqual({ id: 'file-456', webViewLink: null });
  });

  it('throws on non-OK responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    );
    await expect(
      uploadFileToDrive('bad-token', 'n.txt', 'text/plain', new Uint8Array([1]))
    ).rejects.toThrow('Google Drive upload failed');
  });

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(
      uploadFileToDrive('t', 'n.txt', 'text/plain', new Uint8Array([1]))
    ).rejects.toThrow('Google Drive upload failed');
  });

  it('throws when the response body is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ nope: true }) })
    );
    await expect(
      uploadFileToDrive('t', 'n.txt', 'text/plain', new Uint8Array([1]))
    ).rejects.toThrow('Google Drive upload failed');
  });
});
