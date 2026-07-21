import { z } from 'zod';

/**
 * Zod schema for every environment variable the server reads.
 *
 * Design notes:
 *  - Numeric variables are coerced from their string env representation.
 *  - `REDMINE_URL` is validated with the WHATWG `URL` parser and normalized
 *    (trailing slashes stripped) so downstream URL joins are predictable.
 *  - `REDMINE_API_KEY` is required only in `stdio` mode; in `http` mode the
 *    credential arrives per request. Enforced via `superRefine`.
 *
 * Parsed exactly once at startup by `loadConfig`. `process.env` must not be read
 * anywhere else in the codebase — inject the resulting {@link AppConfig} instead.
 */
export const configSchema = z
  .object({
    // Base URL of the target Redmine instance. Normalized to have no trailing slash.
    REDMINE_URL: z
      .string()
      .min(1, 'REDMINE_URL is required')
      .transform((raw, ctx) => {
        try {
          return new URL(raw).href.replace(/\/+$/, '');
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'must be a valid URL (e.g. https://redmine.example.com)',
          });
          return z.NEVER;
        }
      }),

    // API key for the single user. Presence is enforced conditionally below.
    REDMINE_API_KEY: z.string().min(1).optional(),

    // Transport selection. `http` is a documented placeholder.
    MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),

    // Per-request timeout in milliseconds.
    REDMINE_TIMEOUT_MS: z.coerce
      .number()
      .int('REDMINE_TIMEOUT_MS must be an integer')
      .positive('REDMINE_TIMEOUT_MS must be positive')
      .default(30000),

    // Logging verbosity.
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Reserved for the future http transport.
    HTTP_PORT: z.coerce
      .number()
      .int('HTTP_PORT must be an integer')
      .positive('HTTP_PORT must be positive')
      .default(3000),
  })
  .superRefine((cfg, ctx) => {
    // stdio is single-user: the one API key must be present. http resolves
    // credentials per request, so it does not require REDMINE_API_KEY.
    if (cfg.MCP_TRANSPORT === 'stdio' && !cfg.REDMINE_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDMINE_API_KEY'],
        message: 'REDMINE_API_KEY is required when MCP_TRANSPORT is "stdio"',
      });
    }
  });

/** Fully-typed, validated application configuration. */
export type AppConfig = z.infer<typeof configSchema>;
