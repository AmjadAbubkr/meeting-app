import Config from 'react-native-config';

export const GROQ_API_KEY = Config.GROQ_API_KEY ?? '';
export const GEMINI_API_KEY = Config.GEMINI_API_KEY ?? '';
export const CHUNK_SIZE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_LANGUAGES = ['EN', 'FR'] as const;
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'mp4', 'wav', 'm4a', 'webm'] as const;
