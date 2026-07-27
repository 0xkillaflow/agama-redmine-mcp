import { describe, it, expect } from 'vitest';
import { createAttachmentsResource } from '../../../../src/adapters/redmine/resources/attachments.js';
import { RedmineTransportError } from '../../../../src/domain/errors/index.js';
import { mockHttp } from './support.js';

/** A schema-valid `attachment` payload. */
const attachment = {
  id: 7,
  filename: 'my report.pdf',
  filesize: 2048,
  content_type: 'application/pdf',
  description: 'Quarterly report',
  content_url: 'https://redmine.example.com/attachments/download/7/my%20report.pdf',
  author: { id: 3, name: 'Jane Dev' },
  created_on: '2026-07-02T11:00:00Z',
};

describe('createAttachmentsResource', () => {
  describe('upload', () => {
    it('posts the bytes to /uploads.json with the filename as a query param', async () => {
      const { http, postBinary } = mockHttp();
      postBinary.mockResolvedValue({ upload: { id: 7, token: '7.abc' } });
      const attachments = createAttachmentsResource(http);
      const bytes = new Uint8Array([1, 2, 3]);

      const result = await attachments.upload({ bytes, filename: 'deploy.log' });

      expect(postBinary).toHaveBeenCalledWith('/uploads.json', bytes, 'filename=deploy.log');
      expect(result).toEqual({ id: 7, token: '7.abc' });
    });

    it('encodes a filename containing a space', async () => {
      const { http, postBinary } = mockHttp();
      postBinary.mockResolvedValue({ upload: { id: 8, token: '8.def' } });
      const attachments = createAttachmentsResource(http);

      await attachments.upload({ bytes: new Uint8Array(), filename: 'my report.pdf' });

      expect(postBinary.mock.calls[0]?.[2]).toBe('filename=my+report.pdf');
    });

    it('does not put the description on the wire (Redmine records it at reference time)', async () => {
      const { http, postBinary } = mockHttp();
      postBinary.mockResolvedValue({ upload: { id: 9, token: '9.ghi' } });
      const attachments = createAttachmentsResource(http);

      await attachments.upload({
        bytes: new Uint8Array(),
        filename: 'x.txt',
        description: 'a caption',
      });

      expect(postBinary.mock.calls[0]?.[2]).toBe('filename=x.txt');
    });

    it('turns a malformed upload envelope into a transport error', async () => {
      const { http, postBinary } = mockHttp();
      postBinary.mockResolvedValue({ upload: { id: 7 } });
      const attachments = createAttachmentsResource(http);

      await expect(
        attachments.upload({ bytes: new Uint8Array(), filename: 'x.txt' }),
      ).rejects.toBeInstanceOf(RedmineTransportError);
    });
  });

  describe('get', () => {
    it('unwraps the attachment envelope', async () => {
      const { http, get } = mockHttp();
      get.mockResolvedValue({ attachment });
      const attachments = createAttachmentsResource(http);

      const result = await attachments.get(7);

      expect(get).toHaveBeenCalledWith('/attachments/7.json');
      expect(result).toEqual(attachment);
    });

    it('turns a schema-mismatched body into a transport error', async () => {
      const { http, get } = mockHttp();
      get.mockResolvedValue({ attachment: { id: 'seven' } });
      const attachments = createAttachmentsResource(http);

      await expect(attachments.get(7)).rejects.toBeInstanceOf(RedmineTransportError);
    });
  });

  describe('download', () => {
    it('URL-encodes the filename path segment', async () => {
      const { http, getBinary } = mockHttp();
      getBinary.mockResolvedValue({ bytes: new Uint8Array([1]) });
      const attachments = createAttachmentsResource(http);

      await attachments.download(7, 'my report.pdf');

      expect(getBinary).toHaveBeenCalledWith('/attachments/download/7/my%20report.pdf');
    });

    it('returns the raw bytes unchanged', async () => {
      const { http, getBinary } = mockHttp();
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      getBinary.mockResolvedValue({ bytes, contentType: 'image/png' });
      const attachments = createAttachmentsResource(http);

      const result = await attachments.download(7, 'logo.png');

      expect(result).toBe(bytes);
    });
  });
});
