import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'meeting-app-passcode';

export async function hasPasscode() {
  const creds = await Keychain.getGenericPassword({ service: SERVICE_NAME });
  return !!creds;
}

export async function savePasscode(passcode: string) {
  await Keychain.setGenericPassword('passcode', passcode, { service: SERVICE_NAME });
}

export async function verifyPasscode(passcode: string) {
  const creds = await Keychain.getGenericPassword({ service: SERVICE_NAME });
  return !!creds && creds.password === passcode;
}
