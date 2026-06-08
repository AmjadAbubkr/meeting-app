import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getApiKey, setApiKey, deleteApiKey, hasApiKey } from '../services/apiKeys';
import * as Keychain from 'react-native-keychain';

describe('apiKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getApiKey returns empty string when no key found', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue(null as any);
    const result = await getApiKey('groq');
    expect(result).toBe('');
  });

  it('getApiKey returns password when key found', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue({ password: 'sk-abc123' } as any);
    const result = await getApiKey('groq');
    expect(result).toBe('sk-abc123');
  });

  it('setApiKey calls setGenericPassword', async () => {
    await setApiKey('gemini', 'AIz-xyz');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('gemini', 'AIz-xyz', { service: 'meeting-app-api-gemini' });
  });

  it('deleteApiKey calls resetGenericPassword', async () => {
    await deleteApiKey('groq');
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'meeting-app-api-groq' });
  });

  it('hasApiKey returns true when key exists', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue({ password: 'sk-abc' } as any);
    const result = await hasApiKey('groq');
    expect(result).toBe(true);
  });

  it('hasApiKey returns false when no key', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue(null as any);
    const result = await hasApiKey('groq');
    expect(result).toBe(false);
  });
});
