import { describe, it, expect } from 'vitest';
import { createEnvCredentialProvider } from '../../../src/adapters/credentials/env-credential-provider.js';
import { RedmineAuthError } from '../../../src/domain/errors/index.js';

describe('createEnvCredentialProvider', () => {
  it('resolves the configured API key for every request', async () => {
    const provider = createEnvCredentialProvider('secret-key');
    const credentials = await provider.resolve({});
    expect(credentials).toEqual({ kind: 'apiKey', value: 'secret-key' });
  });

  it('ignores request metadata and always returns the same key', async () => {
    const provider = createEnvCredentialProvider('secret-key');
    const withHeaders = await provider.resolve({
      headers: { authorization: 'Bearer ignored' },
    });
    expect(withHeaders).toEqual({ kind: 'apiKey', value: 'secret-key' });
  });

  it('throws a RedmineAuthError when the key is empty', () => {
    expect(() => createEnvCredentialProvider('')).toThrow(RedmineAuthError);
  });

  it('throws a RedmineAuthError when the key is whitespace only', () => {
    expect(() => createEnvCredentialProvider('   ')).toThrow(RedmineAuthError);
  });
});
