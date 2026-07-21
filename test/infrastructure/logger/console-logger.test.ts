import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createConsoleLogger } from '../../../src/infrastructure/logger/console-logger.js';

/**
 * Capture everything written to stderr and assert stdout is never touched
 * (ADR-0006: stdout is the JSON-RPC channel).
 */
describe('createConsoleLogger', () => {
  let stderrLines: string[];
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrLines = [];
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    });
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  /** Parse the single JSON record from the last stderr write. */
  const lastRecord = (): Record<string, unknown> => {
    const line = stderrLines.at(-1);
    expect(line).toBeDefined();
    expect(line?.endsWith('\n')).toBe(true);
    return JSON.parse(line as string) as Record<string, unknown>;
  };

  it('writes records to stderr and never to stdout', () => {
    const logger = createConsoleLogger({ level: 'info' });

    logger.info('hello', { foo: 'bar' });

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrLines).toHaveLength(1);

    const record = lastRecord();
    expect(record).toMatchObject({ level: 'info', msg: 'hello', foo: 'bar' });
    expect(typeof record['time']).toBe('string');
  });

  it('filters records below the configured level', () => {
    const logger = createConsoleLogger({ level: 'info' });

    logger.debug('suppressed');
    expect(stderrLines).toHaveLength(0);

    logger.info('emitted');
    logger.warn('emitted');
    logger.error('emitted');
    expect(stderrLines).toHaveLength(3);
  });

  it('emits every level when configured at debug', () => {
    const logger = createConsoleLogger({ level: 'debug' });

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(stderrLines).toHaveLength(4);
  });

  it('stamps base bindings onto every record', () => {
    const logger = createConsoleLogger({ level: 'info', base: { service: 'redmine-mcp' } });

    logger.info('x');

    expect(lastRecord()).toMatchObject({ service: 'redmine-mcp', msg: 'x' });
  });

  it('merges child() bindings into every subsequent record', () => {
    const logger = createConsoleLogger({ level: 'info' });
    const child = logger.child({ tool: 'redmine_list_issues' });

    child.info('first');
    expect(lastRecord()).toMatchObject({ tool: 'redmine_list_issues', msg: 'first' });

    const grandchild = child.child({ requestId: 'abc' });
    grandchild.info('second', { extra: 1 });
    expect(lastRecord()).toMatchObject({
      tool: 'redmine_list_issues',
      requestId: 'abc',
      extra: 1,
      msg: 'second',
    });

    // The parent logger is unaffected by child bindings.
    logger.info('third');
    expect(lastRecord()['tool']).toBeUndefined();
  });

  it('lets per-record meta override a binding of the same key', () => {
    const logger = createConsoleLogger({ level: 'info', base: { scope: 'base' } });

    logger.info('x', { scope: 'override' });

    expect(lastRecord()['scope']).toBe('override');
  });

  it('redacts known-sensitive keys (case-insensitive) anywhere in the record', () => {
    const logger = createConsoleLogger({ level: 'info' });

    logger.info('auth attempt', {
      api_key: 'super-secret',
      Authorization: 'Bearer abc',
      token: 'tok',
      nested: { TOKEN: 'deep-secret', keep: 'visible' },
    });

    const record = lastRecord();
    expect(record['api_key']).toBe('[REDACTED]');
    expect(record['Authorization']).toBe('[REDACTED]');
    expect(record['token']).toBe('[REDACTED]');
    const nested = record['nested'] as Record<string, unknown>;
    expect(nested['TOKEN']).toBe('[REDACTED]');
    expect(nested['keep']).toBe('visible');
  });

  it('serializes records containing circular references without throwing', () => {
    const logger = createConsoleLogger({ level: 'info' });
    const circular: Record<string, unknown> = { name: 'loop' };
    circular['self'] = circular;

    expect(() => logger.info('circular', { circular })).not.toThrow();

    const record = lastRecord();
    const emitted = record['circular'] as Record<string, unknown>;
    expect(emitted['name']).toBe('loop');
    expect(emitted['self']).toBe('[Circular]');
  });
});
