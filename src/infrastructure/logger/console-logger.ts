import type { Logger, LogLevel, LogMeta } from '../../domain/ports/logger.js';

/**
 * Console logger adapter — the concrete {@link Logger} used in every mode.
 *
 * It writes **only** to `process.stderr`, one JSON record per line, so it is safe
 * under the stdio transport where `stdout` carries the JSON-RPC stream.
 * Records below the configured level are dropped; `child()` bindings are merged
 * into every record; known-sensitive keys are redacted before serialization.
 *
 * A structured logger (e.g. pino) can replace this adapter later without touching
 * the {@link Logger} port.
 */

/** Numeric ordering so a record is emitted only when its level ≥ the threshold. */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Keys whose values are masked in output. Matched case-insensitively. */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set(['api_key', 'authorization', 'token']);

/** Placeholder written in place of a redacted value. */
const REDACTED = '[REDACTED]';

/** Options for {@link createConsoleLogger}. */
export interface ConsoleLoggerOptions {
  /** Minimum level to emit; records below it are suppressed. */
  readonly level: LogLevel;
  /** Bindings stamped onto every record (e.g. `{ service: 'redmine-mcp' }`). */
  readonly base?: LogMeta;
}

/**
 * Create a stderr-only structured logger.
 *
 * @param options - Configured level and optional base bindings.
 */
export function createConsoleLogger(options: ConsoleLoggerOptions): Logger {
  const threshold = LEVEL_PRIORITY[options.level];
  return build(threshold, { ...options.base });
}

/**
 * Build a logger bound to a fixed level threshold and a set of accumulated
 * bindings. `child()` reuses the same threshold with merged bindings.
 */
function build(threshold: number, bindings: LogMeta): Logger {
  function emit(level: LogLevel, msg: string, meta?: LogMeta): void {
    if (LEVEL_PRIORITY[level] < threshold) return;

    // Record shape: { level, time, msg, ...bindings, ...meta }. Later fields win.
    const record: LogMeta = {
      level,
      time: new Date().toISOString(),
      msg,
      ...bindings,
      ...meta,
    };

    process.stderr.write(`${serialize(record)}\n`);
  }

  return {
    debug: (msg, meta) => emit('debug', msg, meta),
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
    child: (childBindings) => build(threshold, { ...bindings, ...childBindings }),
  };
}

/** Redact sensitive keys, then serialize to a single JSON line (never throws). */
function serialize(record: LogMeta): string {
  const safe = redact(record);
  try {
    return JSON.stringify(safe);
  } catch {
    // Last resort: a serialization failure must never crash the process or,
    // worse, throw uncaught and leak to an unexpected stream.
    return JSON.stringify({ level: record['level'], time: record['time'], msg: record['msg'] });
  }
}

/**
 * Recursively copy `value`, masking any property whose key is sensitive and
 * replacing circular references with a marker. The result is a plain,
 * cycle-free structure safe for `JSON.stringify`.
 */
function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(val, seen);
  }
  return out;
}
