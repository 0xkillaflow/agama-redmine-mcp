import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveAllowedPath } from '../../src/application/file-access.js';
import { FileAccessError } from '../../src/domain/errors/index.js';

/**
 * The security boundary of the attachment tools: a bug here turns "read a local
 * file" into data exfiltration and "save a file" into arbitrary overwrite. Every
 * known bypass class gets a case — traversal, symlink escape, sibling prefix,
 * and the fail-closed empty allowlist — against a real temporary filesystem, so
 * the test exercises the same `realpath` behaviour production does.
 */
describe('resolveAllowedPath', () => {
  let root: string;
  let allowed: string;
  let outside: string;

  beforeAll(async () => {
    // `realpath` the sandbox itself: on macOS `/var` is a symlink to `/private/var`,
    // which would otherwise make every expectation wrong for the wrong reason.
    root = await realpath(await mkdtemp(path.join(tmpdir(), 'file-access-')));
    allowed = path.join(root, 'allowed');
    outside = path.join(root, 'outside');
    await mkdir(allowed);
    await mkdir(outside);
    await mkdir(path.join(root, 'allowed-evil'));
    await writeFile(path.join(allowed, 'report.txt'), 'ok');
    await writeFile(path.join(outside, 'secret.txt'), 'shh');
    await writeFile(path.join(root, 'allowed-evil', 'loot.txt'), 'loot');
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('accepts a file inside an allowed root', async () => {
    const file = path.join(allowed, 'report.txt');

    await expect(resolveAllowedPath(file, [allowed])).resolves.toBe(file);
  });

  it('accepts the allowed root itself', async () => {
    await expect(resolveAllowedPath(allowed, [allowed])).resolves.toBe(allowed);
  });

  it('accepts a not-yet-existing file in an allowed root (a download destination)', async () => {
    const destination = path.join(allowed, 'new-file.bin');

    await expect(resolveAllowedPath(destination, [allowed])).resolves.toBe(destination);
  });

  it('accepts a path under any one of several roots', async () => {
    const file = path.join(outside, 'secret.txt');

    await expect(resolveAllowedPath(file, [allowed, outside])).resolves.toBe(file);
  });

  it('rejects everything when the allowlist is empty (fail closed)', async () => {
    const file = path.join(allowed, 'report.txt');

    await expect(resolveAllowedPath(file, [])).rejects.toBeInstanceOf(FileAccessError);
    await expect(resolveAllowedPath(file, [])).rejects.toThrow(/REDMINE_ALLOWED_DIRECTORIES/);
  });

  it('rejects a `..` traversal out of an allowed root', async () => {
    const traversal = path.join(allowed, '..', 'outside', 'secret.txt');

    await expect(resolveAllowedPath(traversal, [allowed])).rejects.toBeInstanceOf(FileAccessError);
  });

  it('rejects a deep traversal to a system path', async () => {
    const traversal = path.join(allowed, '../'.repeat(12), 'etc/passwd');

    await expect(resolveAllowedPath(traversal, [allowed])).rejects.toBeInstanceOf(FileAccessError);
  });

  it('rejects a symlink inside an allowed root that points outside it', async () => {
    const link = path.join(allowed, 'escape.txt');
    await symlink(path.join(outside, 'secret.txt'), link);

    // The link *is* inside the root by name — only realpath-before-check catches it.
    await expect(resolveAllowedPath(link, [allowed])).rejects.toBeInstanceOf(FileAccessError);
  });

  it('rejects a new file under a symlinked directory that escapes the root', async () => {
    const linkedDir = path.join(allowed, 'linked-dir');
    await symlink(outside, linkedDir);

    await expect(
      resolveAllowedPath(path.join(linkedDir, 'planted.txt'), [allowed]),
    ).rejects.toBeInstanceOf(FileAccessError);
  });

  it("rejects a sibling directory sharing the root's name prefix", async () => {
    // `/…/allowed-evil` must not pass a `/…/allowed` prefix test: containment is
    // decided on path segments, not string prefixes.
    const sibling = path.join(root, 'allowed-evil', 'loot.txt');

    await expect(resolveAllowedPath(sibling, [allowed])).rejects.toBeInstanceOf(FileAccessError);
  });

  it('resolves a symlinked allowed root so paths under it still match', async () => {
    const linkedRoot = path.join(root, 'allowed-link');
    await symlink(allowed, linkedRoot);

    // Configured via the link, requested via the link: canonicalizing both sides
    // is what makes this work.
    await expect(
      resolveAllowedPath(path.join(linkedRoot, 'report.txt'), [linkedRoot]),
    ).resolves.toBe(path.join(allowed, 'report.txt'));
  });

  it('rejects when every configured root is missing', async () => {
    const missing = path.join(root, 'does-not-exist');

    await expect(
      resolveAllowedPath(path.join(allowed, 'report.txt'), [missing]),
    ).rejects.toBeInstanceOf(FileAccessError);
  });

  it('names the configured roots but not the rejected path in the error message', async () => {
    const error = await resolveAllowedPath(path.join(outside, 'secret.txt'), [allowed]).catch(
      (err: unknown) => err as FileAccessError,
    );

    expect(error.message).toContain(allowed);
    expect(error.message).not.toContain('secret.txt');
  });
});
