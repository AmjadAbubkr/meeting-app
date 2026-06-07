import RNFS from 'react-native-fs';
import { getApiKey } from './apiKeys';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';

/**
 * Transcribe audio chunks using the Groq Whisper API.
 *
 * @param audioChunks - Array of file URIs (local paths) for each audio chunk
 * @param language - Language code to hint the transcription (e.g. 'en', 'fr')
 * @param onProgress - Optional callback invoked after each chunk with (current, total)
 * @returns Concatenated raw transcript from all chunks
 */
export async function transcribeChunks(
  audioChunks: string[],
  language: string,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  const apiKey = await getApiKey('groq');
  if (!apiKey) {
    throw new Error('Groq API key is missing. Add it in Settings.');
  }

  if (!audioChunks.length) {
    throw new Error('No audio chunks to transcribe.');
  }

  const langCode = language.toLowerCase();
  const parts: string[] = [];

  for (let i = 0; i < audioChunks.length; i += 1) {
    try {
      const chunkPath = audioChunks[i];

      // Verify the file exists before uploading
      const exists = await RNFS.exists(chunkPath);
      if (!exists) {
        // Skip missing files gracefully
        onProgress?.(i + 1, audioChunks.length);
        continue;
      }

      // Read the file as base64
      const base64Audio = await RNFS.readFile(chunkPath, 'base64');

      if (!base64Audio) {
        // Skip empty files gracefully
        onProgress?.(i + 1, audioChunks.length);
        continue;
      }

      // Get the filename for the multipart upload
      const filename = chunkPath.split('/').pop() || 'audio.m4a';

      // Build multipart form-data body
      const boundary = `----FormBoundary${Date.now()}`;
      const CRLF = '\r\n';

      // Build text parts of the multipart body as a single string
      const preamble = [
        `--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}${GROQ_MODEL}${CRLF}`,
        `--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}${langCode}${CRLF}`,
        `--${boundary}${CRLF}Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}verbose_json${CRLF}`,
        `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`,
      ].join('');

      const epilogue = `${CRLF}--${boundary}--${CRLF}`;

      const encoder = new TextEncoder();
      const headerBytes = encoder.encode(preamble);
      const audioBytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
      const footerBytes = encoder.encode(epilogue);

      // Convert to bytes for proper binary handling
      const encoder = new TextEncoder();
      const headerBytes = encoder.encode(headerStr);
      const audioBytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
      const footerBytes = encoder.encode(footerStr);

      // Combine into a single Uint8Array
      const totalLength = headerBytes.length + audioBytes.length + footerBytes.length;
      const bodyBytes = new Uint8Array(totalLength);
      bodyBytes.set(headerBytes, 0);
      bodyBytes.set(audioBytes, headerBytes.length);
      bodyBytes.set(footerBytes, headerBytes.length + audioBytes.length);

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBytes as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Groq API error (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson?.error?.message) {
            errorMessage = `Groq API error: ${errorJson.error.message}`;
          }
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // verbose_json returns { text, segments, ... } — we want the text
      if (result.text && result.text.trim()) {
        parts.push(result.text.trim());
      }
      // If the chunk returns empty text, skip it gracefully
    } catch (error) {
      // Re-throw API errors (auth, server errors) but skip file-level errors
      if (error instanceof Error && error.message.startsWith('Groq API error')) {
        throw error;
      }
      // For other errors (file read, network), skip this chunk gracefully
    }

    onProgress?.(i + 1, audioChunks.length);
  }

  const rawTranscript = parts.join(' ');

  if (!rawTranscript.trim()) {
    throw new Error('Transcription returned empty results for all chunks.');
  }

  return rawTranscript;
}
