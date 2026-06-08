import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { hasPasscode, savePasscode, verifyPasscode } from '../services/passcode';
import * as Keychain from 'react-native-keychain';

describe('passcode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hasPasscode returns false when no passcode stored', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue(null as any);
    const result = await hasPasscode();
    expect(result).toBe(false);
  });

  it('hasPasscode returns true when passcode exists', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue({ password: '123456' } as any);
    const result = await hasPasscode();
    expect(result).toBe(true);
  });

  it('savePasscode calls setGenericPassword', async () => {
    await savePasscode('654321');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('passcode', '654321', { service: 'meeting-app-passcode' });
  });

  it('verifyPasscode returns true for matching passcode', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue({ password: '123456' } as any);
    const result = await verifyPasscode('123456');
    expect(result).toBe(true);
  });

  it('verifyPasscode returns false for wrong passcode', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue({ password: '123456' } as any);
    const result = await verifyPasscode('999999');
    expect(result).toBe(false);
  });

  it('verifyPasscode returns false when no passcode stored', async () => {
    (Keychain.getGenericPassword as jest.MockedFunction<typeof Keychain.getGenericPassword>).mockResolvedValue(null as any);
    const result = await verifyPasscode('123456');
    expect(result).toBe(false);
  });
});
