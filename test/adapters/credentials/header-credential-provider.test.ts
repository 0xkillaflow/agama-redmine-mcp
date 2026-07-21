import { describe, it, expect } from 'vitest';
import { createHeaderCredentialProvider } from '../../../src/adapters/credentials/header-credential-provider.js';
import { RedmineAuthError } from '../../../src/domain/errors/index.js';

describe('createHeaderCredentialProvider', () => {
  it('extracts a bearer token from the Authorization header', async () => {
    const provider = createHeaderCredentialProvider();
    const credentials = await provider.resolve({
      headers: { authorization: 'Bearer abc123' },
    });
    expect(credentials).toEqual({ kind: 'bearer', value: 'abc123' });
  });

  it('reads the header case-insensitively (name and scheme)', async () => {
    const provider = createHeaderCredentialProvider();
    const credentials = await provider.resolve({
      headers: { Authorization: 'bearer abc123' },
    });
    expect(credentials).toEqual({ kind: 'bearer', value: 'abc123' });
  });

  it('tolerates surrounding and inner whitespace', async () => {
    const provider = createHeaderCredentialProvider();
    const credentials = await provider.resolve({
      headers: { authorization: '  Bearer   abc123  ' },
    });
    expect(credentials).toEqual({ kind: 'bearer', value: 'abc123' });
  });

  it('rejects when the Authorization header is missing', async () => {
    const provider = createHeaderCredentialProvider();
    await expect(provider.resolve({ headers: {} })).rejects.toBeInstanceOf(RedmineAuthError);
    await expect(provider.resolve({})).rejects.toBeInstanceOf(RedmineAuthError);
  });

  it('rejects a non-Bearer scheme', async () => {
    const provider = createHeaderCredentialProvider();
    await expect(
      provider.resolve({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }),
    ).rejects.toBeInstanceOf(RedmineAuthError);
  });

  it('rejects an empty bearer token', async () => {
    const provider = createHeaderCredentialProvider();
    await expect(
      provider.resolve({ headers: { authorization: 'Bearer    ' } }),
    ).rejects.toBeInstanceOf(RedmineAuthError);
  });
});
