/**
 * `redmine_download_attachment` — fetch an attachment and save it locally.
 *
 * The mirror of `redmine_upload_attachment`, and the closing half of the loop
 * `redmine_get_issue` opens: `include=attachments` reveals that an issue has a
 * `deploy.log` and what its id is, and this retrieves the contents.
 *
 * Two hazards shape the flow. The filename comes from *Redmine* — i.e. from
 * whoever uploaded the file — so it is attacker-influenced data and is reduced
 * to a bare basename before it can steer the destination. And the destination is
 * a local write, so the joined path is validated against the
 * `REDMINE_ALLOWED_DIRECTORIES` allowlist before the download is even requested,
 * and an existing file is never overwritten.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { FileAccessError } from '../../../domain/errors/index.js';
import type { DownloadResult } from '../../../domain/models/index.js';
import { resolveAllowedPath } from '../../file-access.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_download_attachment`. */
const inputShape = {
  attachment_id: z
    .number()
    .int()
    .positive()
    .describe(
      'Numeric id of the attachment. Get it from `redmine_get_issue` with `include: ' +
        '["attachments"]`, which lists each attachment id, filename, and size.',
    ),
  save_path: z
    .string()
    .min(1)
    .describe(
      'Destination **directory** — the filename is appended to it, so do not include one. It ' +
        'must resolve inside the operator-allowlisted REDMINE_ALLOWED_DIRECTORIES.',
    ),
  filename: z
    .string()
    .optional()
    .describe(
      "Name to save the file under. Defaults to the attachment's own filename. Any directory " +
        'part is stripped: only a bare filename is honoured.',
    ),
};

/** Reduce a caller- or Redmine-supplied name to a safe, bare filename. */
function safeFilename(candidate: string): string {
  // `basename` collapses `../../evil.sh` to `evil.sh`, and any absolute path to
  // its last segment — so the name can never select the directory.
  const name = path.basename(candidate.trim());
  if (name === '' || name === '.' || name === '..') {
    throw new FileAccessError(
      'The attachment filename is not usable as a local file name; pass an explicit `filename`.',
    );
  }
  return name;
}

export const downloadAttachmentTool = defineTool({
  name: 'redmine_download_attachment',
  title: 'Download attachment',
  description:
    'Download a Redmine attachment and save it into a local directory. Find the id with ' +
    '`redmine_get_issue` using `include: ["attachments"]`. The file is written into `save_path` ' +
    "under the attachment's own name unless you override `filename`. The destination must be " +
    'inside the operator-configured REDMINE_ALLOWED_DIRECTORIES, and an existing file is never ' +
    'overwritten — the call fails instead, so pass a different `filename` or directory to retry. ' +
    'Returns where the file was saved, its name, and its size in bytes.',
  inputSchema: inputShape,
  // `readOnlyHint: false` deliberately: nothing in Redmine changes, but the tool
  // writes to the local filesystem, and claiming read-only would understate that
  // to the client. Idempotent, because a repeated call cannot change the outcome
  // (the second one refuses to overwrite).
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handle: async (input, { redmine, allowedDirectories }): Promise<DownloadResult> => {
    // Metadata first: it supplies the default filename and the content type, and
    // it fails fast on a bad id before anything touches the disk.
    const attachment = await redmine.attachments.get(input.attachment_id);
    const filename = safeFilename(input.filename ?? attachment.filename);

    // Join, *then* validate: the guard must see the final destination, since the
    // filename is the part an uploader could have influenced.
    const destination = await resolveAllowedPath(
      path.join(input.save_path, filename),
      allowedDirectories,
    );

    // Only now, with a vetted destination, is the payload fetched. The download
    // URL is built from the path (never from the metadata's absolute
    // `content_url`, which would bypass the requester's auth and timeout).
    const bytes = await redmine.attachments.download(input.attachment_id, attachment.filename);

    try {
      // `wx` fails if the path exists: refusing to clobber is the safe default,
      // and doing it in the open flag keeps it free of a check-then-write race.
      await writeFile(destination, bytes, { flag: 'wx' });
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      if (code === 'EEXIST') {
        throw new FileAccessError(
          `A file already exists at ${destination} and this tool never overwrites. ` +
            'Choose a different `filename` or `save_path`.',
          { cause },
        );
      }
      throw cause;
    }

    return {
      saved_to: destination,
      filename,
      size: bytes.length,
      content_type: attachment.content_type,
    };
  },
});
