import * as Keychain from 'react-native-keychain';

/**
 * API keys are stored in the Keychain using separate service names per key.
 * Service: 'meeting-app-api-groq' for Groq, 'meeting-app-api-gemini' for Gemini.
 * Username is always the key name; password is the API key value.
 */

function getServiceName(keyName: 'groq' | 'gemini'): string {
  return `meeting-app-api-${keyName}`;
}

/**
 * Retrieve an API key from the Keychain.
 * Falls back to empty string if not found (the calling service will throw a user-facing error).
 */
export async function getApiKey(keyName: 'groq' | 'gemini'): Promise<string> {
  try {
    const creds = await Keychain.getGenericPassword({
      service: getServiceName(keyName),
    });
    if (creds && typeof creds === 'object') {
      return creds.password;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Save an API key to the Keychain.
 */
export async function setApiKey(keyName: 'groq' | 'gemini', keyValue: string): Promise<void> {
  await Keychain.setGenericPassword(keyName, keyValue, {
    service: getServiceName(keyName),
  });
}

/**
 * Delete an API key from the Keychain.
 */
export async function deleteApiKey(keyName: 'groq' | 'gemini'): Promise<boolean> {
  return Keychain.resetGenericPassword({
    service: getServiceName(keyName),
  });
}

/**
 * Check if an API key exists in the Keychain.
 */
export async function hasApiKey(keyName: 'groq' | 'gemini'): Promise<boolean> {
  const key = await getApiKey(keyName);
  return key.length > 0;
}
