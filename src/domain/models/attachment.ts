import { z } from 'zod';

/**
 * Wire and tool-facing models for attachments.
 *
 * The *reference* side already exists elsewhere and is deliberately not
 * duplicated here: `AttachmentRefSchema` (in {@link ./common.ts}) is what
 * Redmine returns for an attached file, and `UploadTokenSchema` (in
 * {@link ./issue.ts}) is what an issue write payload carries in its `uploads`
 * array. This module adds the two pieces the attachment *tools* need: the
 * result of an upload, and the result of a download.
 *
 * Naming / optionality conventions are documented in {@link ./common.ts}.
 */

/**
 * The `upload` envelope returned by `POST /uploads.json`. The `token` is the
 * whole point: on its own it does nothing, but placed in an issue's `uploads`
 * array it binds the stored file to that issue.
 */
export const UploadResultSchema = z.object({
  id: z.number(),
  token: z.string(),
});
export type UploadResult = z.infer<typeof UploadResultSchema>;

/**
 * The input to an upload, as seen by the port. It carries **bytes, not a path**:
 * reading the filesystem is an application concern (and a guarded one), so the
 * gateway never touches disk and fakes stay filesystem-free.
 */
export interface UploadFileInput {
  /** The file's raw content. */
  readonly bytes: Uint8Array;
  /** The name Redmine should store the file under. */
  readonly filename: string;
  /**
   * Optional caption. Redmine records it when the token is *referenced* (from an
   * issue's `uploads` array), not at upload time — it is carried here so the
   * upload result can hand the caller a ready-to-use `uploads` entry.
   */
  readonly description?: string;
}

/** What `redmine_download_attachment` reports after writing a file locally. */
export interface DownloadResult {
  /** Absolute, canonical path the file was written to. */
  readonly saved_to: string;
  /** The name the file was saved under. */
  readonly filename: string;
  /** Size in bytes of the written file. */
  readonly size: number;
  /** The attachment's MIME type, as reported by Redmine. */
  readonly content_type?: string;
}
