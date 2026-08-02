import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'meeting-app-passcode';
const LOCKOUT_SERVICE_NAME = 'meeting-app-passcode-lockout';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

type LockoutState = {
  failedAttempts: number;
  lockedUntil: number;
};

async function getLockoutState(): Promise<LockoutState> {
  const creds = await Keychain.getGenericPassword({ service: LOCKOUT_SERVICE_NAME });
  if (!creds || typeof creds !== 'object') {
    return { failedAttempts: 0, lockedUntil: 0 };
  }

  try {
    const parsed = JSON.parse(creds.password) as Partial<LockoutState>;
    return {
      failedAttempts: Number(parsed.failedAttempts) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { failedAttempts: 0, lockedUntil: 0 };
  }
}

async function saveLockoutState(state: LockoutState): Promise<void> {
  await Keychain.setGenericPassword('lockout', JSON.stringify(state), {
    service: LOCKOUT_SERVICE_NAME,
  });
}

async function clearLockoutState(): Promise<void> {
  await Keychain.resetGenericPassword({ service: LOCKOUT_SERVICE_NAME });
}

export async function hasPasscode() {
  const creds = await Keychain.getGenericPassword({ service: SERVICE_NAME });
  return !!creds;
}

export async function savePasscode(passcode: string) {
  await Keychain.setGenericPassword('passcode', passcode, { service: SERVICE_NAME });
  await clearLockoutState();
}

export async function verifyPasscode(passcode: string) {
  const lockout = await getLockoutState();
  if (lockout.lockedUntil > Date.now()) return false;

  const creds = await Keychain.getGenericPassword({ service: SERVICE_NAME });
  if (creds && creds.password === passcode) {
    await clearLockoutState();
    return true;
  }

  const failedAttempts = lockout.failedAttempts + 1;
  await saveLockoutState({
    failedAttempts: failedAttempts >= MAX_FAILED_ATTEMPTS ? 0 : failedAttempts,
    lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  });
  return false;
}
