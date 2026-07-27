import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadAttachmentTool } from '../../../src/application/tools/attachments/upload-attachment.tool.js';
import { downloadAttachmentTool } from '../../../src/application/tools/attachments/download-attachment.tool.js';
import { FileAccessError } from '../../../src/domain/errors/index.js';
import { fakeRedmineClient, toolContext, type FakeRedmineClient } from './support.js';

/** A schema-shaped `attachment` metadata value the fake returns from `get`. */
const attachmentMeta = {
  id: 7,
  filename: 'deploy.log',
  filesize: 11,
  content_type: 'text/plain',
  description: '',
  content_url: 'https://redmine.example.com/attachments/download/7/deploy.log',
  author: { id: 3, name: 'Jane Dev' },
  created_on: '2026-07-02T11:00:00Z',
};

describe('attachment tools', () => {
  let sandbox: string;
  let allowed: string;
  let outside: string;
  let client: FakeRedmineClient;

  beforeEach(async () => {
    // Realpath the sandbox: on macOS the temp dir is itself a symlink.
    sandbox = await realpath(await mkdtemp(path.join(tmpdir(), 'attachment-tools-')));
    allowed = path.join(sandbox, 'allowed');
    outside = path.join(sandbox, 'outside');
    await mkdir(allowed);
    await mkdir(outside);
    client = fakeRedmineClient();
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  describe('redmine_upload_attachment', () => {
    it('is a non-idempotent write against the open world', () => {
      expect(uploadAttachmentTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      });
    });

    it('explains the two-step token → uploads flow', () => {
      expect(uploadAttachmentTool.description).toContain('uploads');
      expect(uploadAttachmentTool.description).toContain('redmine_create_issue');
    });

    it("sends the file's bytes and basename, and returns an uploads-ready entry", async () => {
      const file = path.join(allowed, 'deploy.log');
      await writeFile(file, 'hello bytes');
      client.attachments.upload.mockResolvedValue({ id: 7, token: '7.abc' });

      const result = await uploadAttachmentTool.handle(
        { file_path: file, description: 'the deploy log' },
        toolContext(client, [allowed]),
      );

      const sent = client.attachments.upload.mock.calls[0]?.[0] as {
        bytes: Uint8Array;
        filename: string;
      };
      expect(new TextDecoder().decode(sent.bytes)).toBe('hello bytes');
      // Only the basename travels: the local directory layout stays local.
      expect(sent.filename).toBe('deploy.log');
      expect(result).toEqual({
        id: 7,
        token: '7.abc',
        filename: 'deploy.log',
        description: 'the deploy log',
      });
    });

    it('omits the description when none was given', async () => {
      const file = path.join(allowed, 'notes.txt');
      await writeFile(file, 'x');
      client.attachments.upload.mockResolvedValue({ id: 1, token: '1.abc' });

      const result = await uploadAttachmentTool.handle(
        { file_path: file },
        toolContext(client, [allowed]),
      );

      expect(result).toEqual({ id: 1, token: '1.abc', filename: 'notes.txt' });
    });

    it('rejects a path outside the allowlist before making any call', async () => {
      const secret = path.join(outside, 'id_rsa');
      await writeFile(secret, 'PRIVATE KEY');

      await expect(
        uploadAttachmentTool.handle({ file_path: secret }, toolContext(client, [allowed])),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(client.attachments.upload).not.toHaveBeenCalled();
    });

    it('rejects a traversal that leaves the allowlist', async () => {
      await writeFile(path.join(outside, 'secret.txt'), 'shh');
      const traversal = path.join(allowed, '..', 'outside', 'secret.txt');

      await expect(
        uploadAttachmentTool.handle({ file_path: traversal }, toolContext(client, [allowed])),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(client.attachments.upload).not.toHaveBeenCalled();
    });

    it('rejects every path when no directory is allowlisted', async () => {
      const file = path.join(allowed, 'deploy.log');
      await writeFile(file, 'hello');

      await expect(
        uploadAttachmentTool.handle({ file_path: file }, toolContext(client)),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(client.attachments.upload).not.toHaveBeenCalled();
    });
  });

  describe('redmine_download_attachment', () => {
    beforeEach(() => {
      client.attachments.get.mockResolvedValue(attachmentMeta);
      client.attachments.download.mockResolvedValue(new TextEncoder().encode('hello bytes'));
    });

    it('writes locally, so it is not read-only, but it is idempotent', () => {
      expect(downloadAttachmentTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("saves under the attachment's own filename when none is given", async () => {
      const result = await downloadAttachmentTool.handle(
        { attachment_id: 7, save_path: allowed },
        toolContext(client, [allowed]),
      );

      expect(result).toEqual({
        saved_to: path.join(allowed, 'deploy.log'),
        filename: 'deploy.log',
        size: 11,
        content_type: 'text/plain',
      });
      expect(await readFile(path.join(allowed, 'deploy.log'), 'utf8')).toBe('hello bytes');
      // The download URL is built from Redmine's own filename, not the local one.
      expect(client.attachments.download).toHaveBeenCalledWith(7, 'deploy.log');
    });

    it('honours a caller-supplied filename', async () => {
      const result = await downloadAttachmentTool.handle(
        { attachment_id: 7, save_path: allowed, filename: 'renamed.log' },
        toolContext(client, [allowed]),
      );

      expect(result.filename).toBe('renamed.log');
      expect(result.saved_to).toBe(path.join(allowed, 'renamed.log'));
    });

    it('reduces a Redmine-supplied traversal filename to a bare name', async () => {
      // The filename comes from whoever uploaded the file — treat it as hostile.
      client.attachments.get.mockResolvedValue({ ...attachmentMeta, filename: '../../evil.sh' });

      const result = await downloadAttachmentTool.handle(
        { attachment_id: 7, save_path: allowed },
        toolContext(client, [allowed]),
      );

      expect(result.filename).toBe('evil.sh');
      expect(result.saved_to).toBe(path.join(allowed, 'evil.sh'));
    });

    it('strips a directory part from a caller-supplied filename', async () => {
      const result = await downloadAttachmentTool.handle(
        { attachment_id: 7, save_path: allowed, filename: '../../../etc/passwd' },
        toolContext(client, [allowed]),
      );

      expect(result.saved_to).toBe(path.join(allowed, 'passwd'));
    });

    it('rejects a filename that reduces to nothing usable', async () => {
      client.attachments.get.mockResolvedValue({ ...attachmentMeta, filename: '../' });

      await expect(
        downloadAttachmentTool.handle(
          { attachment_id: 7, save_path: allowed },
          toolContext(client, [allowed]),
        ),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(client.attachments.download).not.toHaveBeenCalled();
    });

    it('rejects a save_path outside the allowlist before downloading', async () => {
      await expect(
        downloadAttachmentTool.handle(
          { attachment_id: 7, save_path: outside },
          toolContext(client, [allowed]),
        ),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(client.attachments.download).not.toHaveBeenCalled();
    });

    it('rejects every destination when no directory is allowlisted', async () => {
      await expect(
        downloadAttachmentTool.handle(
          { attachment_id: 7, save_path: allowed },
          toolContext(client),
        ),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(client.attachments.download).not.toHaveBeenCalled();
    });

    it('refuses to overwrite an existing file', async () => {
      const existing = path.join(allowed, 'deploy.log');
      await writeFile(existing, 'do not clobber me');

      await expect(
        downloadAttachmentTool.handle(
          { attachment_id: 7, save_path: allowed },
          toolContext(client, [allowed]),
        ),
      ).rejects.toBeInstanceOf(FileAccessError);
      expect(await readFile(existing, 'utf8')).toBe('do not clobber me');
    });

    it('states the no-overwrite policy in its description', () => {
      expect(downloadAttachmentTool.description).toMatch(/never overwritten/i);
    });
  });
});
