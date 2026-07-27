/**
 * Local filesystem access errors.
 *
 * The attachment tools are the only code that touches the local disk, and they
 * may do so exclusively inside the `REDMINE_ALLOWED_DIRECTORIES` allowlist. A
 * refused path is neither a failed Redmine interaction nor a server fault, so
 * this error deliberately sits *outside* the {@link RedmineError} hierarchy —
 * `isRedmineError` does not narrow to it — much like `NotImplementedError`.
 *
 * Its `message` is agent-facing and surfaced verbatim by the MCP result
 * formatter, so it must stay free of secrets: name the configured roots (which
 * the operator chose) and what was wrong, never the contents of the rejected
 * path.
 */
export class FileAccessError extends Error {
  readonly code = 'FILE_ACCESS_DENIED';

  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'FileAccessError';
    // Restore the prototype chain for reliable `instanceof` under ES2022/ESM.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
