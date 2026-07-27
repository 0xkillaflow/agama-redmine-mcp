import { describe, it, expect } from 'vitest';
import { delimiter, resolve } from 'node:path';
import { loadConfig, ConfigError } from '../../src/config/index.js';

/** A minimal valid stdio environment; individual tests override fields. */
const baseEnv = {
  REDMINE_URL: 'https://redmine.example.com',
  REDMINE_API_KEY: 'secret-key',
} satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('parses a valid stdio config into a typed AppConfig with defaults applied', () => {
    const config = loadConfig(baseEnv);

    expect(config).toEqual({
      REDMINE_URL: 'https://redmine.example.com',
      REDMINE_API_KEY: 'secret-key',
      MCP_TRANSPORT: 'stdio',
      REDMINE_TIMEOUT_MS: 30000,
      REDMINE_ALLOWED_DIRECTORIES: [],
      LOG_LEVEL: 'info',
      HTTP_PORT: 3000,
    });
  });

  it('defaults REDMINE_ALLOWED_DIRECTORIES to an empty list (no file access)', () => {
    // Fail closed: an absent allowlist must never mean "anything goes".
    expect(loadConfig(baseEnv).REDMINE_ALLOWED_DIRECTORIES).toEqual([]);
    expect(
      loadConfig({ ...baseEnv, REDMINE_ALLOWED_DIRECTORIES: '' }).REDMINE_ALLOWED_DIRECTORIES,
    ).toEqual([]);
  });

  it('splits REDMINE_ALLOWED_DIRECTORIES on the platform delimiter and normalizes entries', () => {
    const raw = ['/data/uploads/', ' /data/reports '].join(delimiter);

    const config = loadConfig({ ...baseEnv, REDMINE_ALLOWED_DIRECTORIES: raw });

    expect(config.REDMINE_ALLOWED_DIRECTORIES).toEqual([
      resolve('/data/uploads'),
      resolve('/data/reports'),
    ]);
  });

  it('rejects a relative entry in REDMINE_ALLOWED_DIRECTORIES', () => {
    try {
      loadConfig({ ...baseEnv, REDMINE_ALLOWED_DIRECTORIES: './uploads' });
      expect.unreachable('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const issues = (err as ConfigError).issues;
      expect(issues.some((line) => line.startsWith('REDMINE_ALLOWED_DIRECTORIES:'))).toBe(true);
    }
  });

  it('throws ConfigError listing REDMINE_URL when it is missing', () => {
    expect(() => loadConfig({ REDMINE_API_KEY: 'secret-key' })).toThrow(ConfigError);

    try {
      loadConfig({ REDMINE_API_KEY: 'secret-key' });
      expect.unreachable('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const issues = (err as ConfigError).issues;
      expect(issues.some((line) => line.startsWith('REDMINE_URL:'))).toBe(true);
    }
  });

  it('requires REDMINE_API_KEY in stdio mode', () => {
    try {
      loadConfig({ REDMINE_URL: 'https://redmine.example.com' });
      expect.unreachable('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const issues = (err as ConfigError).issues;
      expect(issues.some((line) => line.startsWith('REDMINE_API_KEY:'))).toBe(true);
    }
  });

  it('does not require REDMINE_API_KEY in http mode', () => {
    const config = loadConfig({
      REDMINE_URL: 'https://redmine.example.com',
      MCP_TRANSPORT: 'http',
    });

    expect(config.MCP_TRANSPORT).toBe('http');
    expect(config.REDMINE_API_KEY).toBeUndefined();
  });

  it('coerces numeric env vars and validates them', () => {
    const config = loadConfig({ ...baseEnv, REDMINE_TIMEOUT_MS: '5000', HTTP_PORT: '8080' });

    expect(config.REDMINE_TIMEOUT_MS).toBe(5000);
    expect(config.HTTP_PORT).toBe(8080);
  });

  it('rejects a non-positive REDMINE_TIMEOUT_MS', () => {
    try {
      loadConfig({ ...baseEnv, REDMINE_TIMEOUT_MS: '-1' });
      expect.unreachable('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).issues.some((l) => l.startsWith('REDMINE_TIMEOUT_MS:'))).toBe(
        true,
      );
    }
  });

  it('normalizes a trailing slash in REDMINE_URL', () => {
    const config = loadConfig({ ...baseEnv, REDMINE_URL: 'https://redmine.example.com/redmine/' });
    expect(config.REDMINE_URL).toBe('https://redmine.example.com/redmine');
  });

  it('normalizes a bare-origin trailing slash', () => {
    const config = loadConfig({ ...baseEnv, REDMINE_URL: 'https://redmine.example.com/' });
    expect(config.REDMINE_URL).toBe('https://redmine.example.com');
  });

  it('rejects a malformed REDMINE_URL', () => {
    try {
      loadConfig({ ...baseEnv, REDMINE_URL: 'not-a-url' });
      expect.unreachable('expected ConfigError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).issues.some((l) => l.startsWith('REDMINE_URL:'))).toBe(true);
    }
  });

  it('applies the LOG_LEVEL default and rejects invalid values', () => {
    expect(loadConfig(baseEnv).LOG_LEVEL).toBe('info');
    expect(loadConfig({ ...baseEnv, LOG_LEVEL: 'warn' }).LOG_LEVEL).toBe('warn');
    expect(() => loadConfig({ ...baseEnv, LOG_LEVEL: 'verbose' })).toThrow(ConfigError);
  });
});
