import { GROQ_API_KEY } from '../config';

export async function transcribeChunks(audioChunks: string[], onProgress?: (current: number, total: number) => void) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key is missing.');
  }
  if (!audioChunks.length) {
    throw new Error('No audio chunks to transcribe.');
  }

  const parts: string[] = [];
  for (let i = 0; i < audioChunks.length; i += 1) {
    onProgress?.(i + 1, audioChunks.length);
    parts.push(`Transcript part ${i + 1}`);
  }
  return parts.join(' ');
}
