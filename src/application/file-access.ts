/**
 * The filesystem allowlist guard.
 *
 * The attachment tools read from and write to the local disk on behalf of an
 * agent, which makes a caller-supplied path a security boundary rather than a
 * convenience: without a guard, "upload this file" is a general-purpose file
 * exfiltration primitive (`~/.ssh/id_rsa`, the `.env` holding the API key), and
 * "download to this path" is a general-purpose overwrite primitive. Every path
 * that reaches `fs` must pass through {@link resolveAllowedPath} first.
 *
 * The rules, in the order they matter:
 *
 * 1. **Fail closed.** An empty allowlist means *no* file access, never
 *    unrestricted access. Operators opt in by listing roots in
 *    `REDMINE_ALLOWED_DIRECTORIES`.
 * 2. **Resolve before checking.** The candidate is made absolute *and*
 *    `realpath`-ed, so `..` traversal and symlinks are collapsed before the
 *    containment test — a symlink inside an allowed root pointing outside it is
 *    the obvious bypass, and it must not work. Allowed roots are `realpath`-ed
 *    too, so a symlinked root still matches.
 * 3. **Compare on segment boundaries.** `/data/allowed-evil` must not satisfy a
 *    `/data/allowed` prefix test.
 *
 * This module is application-level policy (it is what a *use case* is permitted
 * to do), so it lives here rather than behind a port; its only dependencies are
 * Node's `path`/`fs` primitives.
 */

import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { FileAccessError } from '../domain/errors/index.js';

/** `realpath` failures that simply mean "this part of the path does not exist yet". */
const MISSING_PATH_CODES = new Set(['ENOENT', 'ENOTDIR']);

/** Read the `code` of a Node system error without an `any` cast. */
function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/**
 * Canonicalize a path that need not exist yet.
 *
 * `fs.realpath` requires the whole path to exist, but a download destination is
 * by definition a file that does not. So the deepest existing ancestor is
 * resolved (collapsing any symlinks along the way) and the missing tail is
 * re-appended — the parts that *could* redirect the path are exactly the parts
 * that exist, so this is as strong as a full `realpath`.
 */
async function canonicalize(candidate: string): Promise<string> {
  let current = path.resolve(candidate);
  const missingTail: string[] = [];

  for (;;) {
    try {
      const real = await realpath(current);
      return missingTail.length === 0 ? real : path.join(real, ...missingTail.reverse());
    } catch (cause) {
      if (!MISSING_PATH_CODES.has(errorCode(cause) ?? '')) {
        throw new FileAccessError(`Cannot resolve the given path: ${current}`, { cause });
      }
      const parent = path.dirname(current);
      if (parent === current) {
        // Walked all the way to the filesystem root without resolving anything.
        throw new FileAccessError(`Cannot resolve the given path: ${path.resolve(candidate)}`, {
          cause,
        });
      }
      missingTail.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Canonicalize the configured roots, dropping any that do not exist — a
 * non-existent root can contain nothing, so it can only ever deny.
 */
async function canonicalRoots(allowedDirs: readonly string[]): Promise<string[]> {
  const resolved = await Promise.all(
    allowedDirs.map((dir) => realpath(path.resolve(dir)).catch(() => undefined)),
  );
  return resolved.filter((dir): dir is string => dir !== undefined);
}

/** Is `target` the root itself, or below it on a path-segment boundary? */
function isInside(root: string, target: string): boolean {
  if (target === root) return true;
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return target.startsWith(prefix);
}

/**
 * Resolve a caller-supplied path and assert it lies inside the allowlist.
 *
 * @param candidate - The path as supplied by the agent (absolute or relative).
 * @param allowedDirs - Configured roots (`REDMINE_ALLOWED_DIRECTORIES`).
 * @returns The canonical absolute path, safe to hand to `fs`.
 * @throws {FileAccessError} when the allowlist is empty, the path cannot be
 * resolved, or the resolved path falls outside every allowed root. The message
 * names the configured roots — never the rejected path's contents.
 */
export async function resolveAllowedPath(
  candidate: string,
  allowedDirs: readonly string[],
): Promise<string> {
  if (allowedDirs.length === 0) {
    throw new FileAccessError(
      'Local file access is disabled: no directories are configured in ' +
        'REDMINE_ALLOWED_DIRECTORIES. Ask the operator to allowlist a directory.',
    );
  }

  const roots = await canonicalRoots(allowedDirs);
  if (roots.length === 0) {
    throw new FileAccessError(
      `None of the configured allowed directories exist: ${allowedDirs.join(', ')}.`,
    );
  }

  const target = await canonicalize(candidate);
  if (!roots.some((root) => isInside(root, target))) {
    throw new FileAccessError(
      `Path is outside the allowed directories (${allowedDirs.join(', ')}). ` +
        'Symlinks and ".." segments are resolved before this check.',
    );
  }

  return target;
}
