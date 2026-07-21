import { configSchema, type AppConfig } from './config.schema.js';

/**
 * Thrown when environment configuration is invalid. Carries the flattened,
 * human-readable list of offending variables. The bootstrap (server.ts) prints
 * these to stderr and exits with code 1 — never a stack trace.
 */
export class ConfigError extends Error {
  /** One `VARIABLE: message` line per failed variable. */
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((line) => `  - ${line}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/**
 * Parse and validate configuration from environment variables exactly once.
 *
 * @param env - Source of variables; defaults to `process.env`.
 * @returns The typed, validated {@link AppConfig}.
 * @throws {ConfigError} with a `VARIABLE: message` line per failure.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const variable = issue.path.length > 0 ? issue.path.join('.') : '(config)';
      return `${variable}: ${issue.message}`;
    });
    throw new ConfigError(issues);
  }

  return result.data;
}
