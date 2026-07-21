/**
 * Logging port.
 *
 * A minimal, transport-agnostic logging interface the application depends on.
 * The concrete adapter lives in `infrastructure/logger`; the domain and
 * application never import it directly — they receive a {@link Logger} instance
 * via constructor injection from the composition root.
 *
 * Critical constraint: in stdio mode `stdout` is the JSON-RPC channel,
 * so every log record MUST be written to `stderr`. That is a property of the
 * adapter, not of this port, but it is the reason the port exists at all.
 */

/** Severity levels, ordered from most to least verbose. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured metadata attached to a single log record. */
export type LogMeta = Record<string, unknown>;

/**
 * A structured logger. Each method emits one record at its level; `meta` adds
 * per-record fields. `child` returns a logger that stamps `bindings` onto every
 * record it (and its own children) subsequently emit — used to attach ambient
 * context such as the current tool name.
 */
export interface Logger {
  debug(msg: string, meta?: LogMeta): void;
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
  child(bindings: LogMeta): Logger;
}
