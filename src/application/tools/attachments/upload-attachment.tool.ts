/**
 * `redmine_upload_attachment` — step one of attaching a local file to an issue.
 *
 * Redmine's attachment flow is deliberately two-phase: the bytes are uploaded
 * first and yield an opaque token, and the token is only bound to an issue when
 * it is passed in the `uploads` array of a create/update call. This tool covers
 * the first phase; without the second, the upload is orphaned and eventually
 * discarded.
 *
 * Reading a caller-supplied path is a privileged act, so every path goes through
 * {@link resolveAllowedPath} against the configured `REDMINE_ALLOWED_DIRECTORIES`
 * allowlist *before* any file is opened and before any request is made.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { resolveAllowedPath } from '../../file-access.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_upload_attachment`. */
const inputShape = {
  file_path: z
    .string()
    .min(1)
    .describe(
      'Path to the local file to upload. It must resolve to a location inside one of the ' +
        'directories the operator allowlisted in REDMINE_ALLOWED_DIRECTORIES; anything else — ' +
        'including a symlink pointing out of them — is refused. If no directory is allowlisted, ' +
        'file access is disabled entirely.',
    ),
  description: z
    .string()
    .optional()
    .describe(
      'Optional caption for the attachment. It is not stored by the upload itself — it is ' +
        'returned so you can pass it along in the `uploads` entry.',
    ),
};

/** What the tool reports back: a ready-to-use `uploads` entry, plus the upload id. */
interface UploadAttachmentResult {
  readonly id: number;
  readonly token: string;
  readonly filename: string;
  readonly description?: string;
}

export const uploadAttachmentTool = defineTool({
  name: 'redmine_upload_attachment',
  title: 'Upload attachment',
  description:
    'Upload a local file to Redmine and get back an upload token. This is the first half of a ' +
    'two-step flow and does nothing visible on its own: the token is not attached to anything ' +
    'until you pass it to `redmine_create_issue` or `redmine_update_issue` in their `uploads` ' +
    'array (e.g. `uploads: [{ token, filename, description }]`) — the returned object is already ' +
    'shaped for exactly that. Tokens expire, so make the second call promptly. The file must sit ' +
    'inside the operator-configured REDMINE_ALLOWED_DIRECTORIES, and Redmine may reject files ' +
    'over its own attachment size limit.',
  inputSchema: inputShape,
  // Not read-only (it creates a stored file on the server) but not destructive
  // (nothing existing is replaced), and *not* idempotent: calling it twice
  // uploads the file twice and yields two distinct tokens.
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handle: async (input, { redmine, allowedDirectories }): Promise<UploadAttachmentResult> => {
    // The guard runs first: an unallowlisted path never reaches `readFile`, let
    // alone the network.
    const resolved = await resolveAllowedPath(input.file_path, allowedDirectories);
    const bytes = await readFile(resolved);
    // Only the basename is sent — the local directory layout is nobody's business.
    const filename = path.basename(resolved);

    const upload = await redmine.attachments.upload({
      bytes,
      filename,
      ...(input.description !== undefined ? { description: input.description } : {}),
    });

    return {
      id: upload.id,
      token: upload.token,
      filename,
      ...(input.description !== undefined ? { description: input.description } : {}),
    };
  },
});
