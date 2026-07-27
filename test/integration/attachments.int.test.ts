import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  connectRealMcp,
  expectStructured,
  runIntegration,
  testProjectIdentifier,
} from './support.js';
import type { InMemoryMcp } from '../support/in-memory-mcp.js';

interface UploadResponse {
  id: number;
  token: string;
  filename: string;
}

interface DownloadResponse {
  saved_to: string;
  filename: string;
  size: number;
}

interface IssueWithAttachments {
  id: number;
  attachments?: Array<{ id: number; filename: string; filesize: number }>;
}

/**
 * The full attachment story against a live Redmine: upload a local file, attach
 * it to a new issue via the token, confirm the issue carries it, then download it
 * back and compare byte for byte. The round trip is the strongest evidence that
 * the binary verbs, the query/path encoding, and the guarded file I/O all agree.
 */
describe.skipIf(!runIntegration)('integration: attachments', () => {
  let mcp: InMemoryMcp;
  let sandbox: string;
  let uploadDir: string;
  let downloadDir: string;
  let projectId: number;

  // A filename with a space, so the download path segment must be encoded.
  const filename = 'deploy notes.txt';
  const contents = `attachment round-trip ${Date.now()}\néè non-ascii\n`;

  beforeAll(async () => {
    sandbox = await realpath(await mkdtemp(path.join(tmpdir(), 'attachment-int-')));
    uploadDir = path.join(sandbox, 'uploads');
    downloadDir = path.join(sandbox, 'downloads');
    await mkdir(uploadDir);
    await mkdir(downloadDir);
    await writeFile(path.join(uploadDir, filename), contents, 'utf8');

    // Only the sandbox is allowlisted: everything else on this machine is off limits.
    mcp = await connectRealMcp([sandbox]);

    const project = expectStructured<{ id: number }>(
      await mcp.callTool('redmine_get_project', { project_id: testProjectIdentifier }),
    );
    projectId = project.id;
  });

  afterAll(async () => {
    await mcp?.close();
    await rm(sandbox, { recursive: true, force: true });
  });

  it('uploads a file, attaches it to an issue, and downloads it back byte-for-byte', async () => {
    const upload = expectStructured<UploadResponse>(
      await mcp.callTool('redmine_upload_attachment', {
        file_path: path.join(uploadDir, filename),
        description: 'round-trip fixture',
      }),
    );
    expect(upload.token).toMatch(/\S/);
    expect(upload.filename).toBe(filename);

    // The token is inert until it is referenced from an issue write.
    const issue = expectStructured<{ id: number }>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        subject: `MCP attachment round-trip ${Date.now()}`,
        uploads: [{ token: upload.token, filename, description: 'round-trip fixture' }],
      }),
    );

    const fetched = expectStructured<IssueWithAttachments>(
      await mcp.callTool('redmine_get_issue', { issue_id: issue.id, include: ['attachments'] }),
    );
    const attached = fetched.attachments?.find((a) => a.filename === filename);
    expect(attached).toBeDefined();

    const download = expectStructured<DownloadResponse>(
      await mcp.callTool('redmine_download_attachment', {
        attachment_id: attached!.id,
        save_path: downloadDir,
      }),
    );

    expect(download.saved_to).toBe(path.join(downloadDir, filename));
    expect(await readFile(download.saved_to, 'utf8')).toBe(contents);
    expect(download.size).toBe(Buffer.byteLength(contents, 'utf8'));
  });

  it('refuses to upload a file outside the allowlist', async () => {
    const outside = path.join(await realpath(tmpdir()), `mcp-outside-${Date.now()}.txt`);
    await writeFile(outside, 'should never be uploaded');

    try {
      const result = await mcp.callTool('redmine_upload_attachment', { file_path: outside });

      expect(result.isError).toBe(true);
      const text = result.content.map((b) => (b.type === 'text' ? b.text : '')).join(' ');
      expect(text).toMatch(/allowed directories/i);
    } finally {
      await rm(outside, { force: true });
    }
  });

  it('refuses to overwrite an existing local file on download', async () => {
    const upload = expectStructured<UploadResponse>(
      await mcp.callTool('redmine_upload_attachment', {
        file_path: path.join(uploadDir, filename),
      }),
    );
    const issue = expectStructured<{ id: number }>(
      await mcp.callTool('redmine_create_issue', {
        project_id: projectId,
        subject: `MCP attachment overwrite guard ${Date.now()}`,
        uploads: [{ token: upload.token, filename }],
      }),
    );
    const fetched = expectStructured<IssueWithAttachments>(
      await mcp.callTool('redmine_get_issue', { issue_id: issue.id, include: ['attachments'] }),
    );
    const attachmentId = fetched.attachments?.[0]?.id;
    expect(attachmentId).toBeDefined();

    const target = path.join(downloadDir, 'occupied.txt');
    await writeFile(target, 'do not clobber me');

    const result = await mcp.callTool('redmine_download_attachment', {
      attachment_id: attachmentId!,
      save_path: downloadDir,
      filename: 'occupied.txt',
    });

    expect(result.isError).toBe(true);
    expect(await readFile(target, 'utf8')).toBe('do not clobber me');
  });
});
