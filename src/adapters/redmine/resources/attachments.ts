/**
 * Attachments resource client: the `AttachmentsResource` port backed by the
 * Redmine HTTP requester.
 *
 * This is the only resource that leaves JSON behind on the wire. Uploading is a
 * raw `application/octet-stream` POST whose *filename travels as a query
 * parameter*, not a header or a multipart part; downloading returns the file
 * itself with no envelope. Both directions deal in bytes only — the guarded
 * filesystem access lives in the tool layer.
 */

import {
  AttachmentRefSchema,
  UploadResultSchema,
  type AttachmentRef,
  type UploadFileInput,
  type UploadResult,
} from '../../../domain/models/index.js';
import type { AttachmentsResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { toQuery } from '../request-builder.js';
import { parseEnvelope } from './parse.js';

/** Build the `AttachmentsResource` bound to the given requester. */
export function createAttachmentsResource(http: HttpRequester): AttachmentsResource {
  return {
    async upload(input: UploadFileInput): Promise<UploadResult> {
      // Only `filename` goes on the wire: Redmine's upload endpoint records the
      // name and the bytes, and picks up a description later, when the returned
      // token is referenced from an issue's `uploads` array.
      const body = await http.postBinary(
        '/uploads.json',
        input.bytes,
        toQuery({ filename: input.filename }),
      );
      return parseEnvelope('upload', UploadResultSchema, body, 'upload attachment');
    },

    async get(id: number): Promise<AttachmentRef> {
      const body = await http.get(`/attachments/${id}.json`);
      return parseEnvelope('attachment', AttachmentRefSchema, body, 'get attachment');
    },

    async download(id: number, filename: string): Promise<Uint8Array> {
      // The filename is a *path segment*, and attachment names routinely contain
      // spaces, `#`, and non-ASCII characters — encoding it is what keeps the URL
      // well-formed and pointing at the intended file.
      const path = `/attachments/download/${id}/${encodeURIComponent(filename)}`;
      const { bytes } = await http.getBinary(path);
      return bytes;
    },
  };
}
