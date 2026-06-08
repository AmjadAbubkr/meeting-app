import RNFS from 'react-native-fs';
import { getApiKey } from './apiKeys';
import { chunkAudioFile, cleanChunkDir } from './chunker';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';

async function transcribeChunk(
  chunkPath: string,
  langCode: string,
  apiKey: string,
): Promise<string> {
  const exists = await RNFS.exists(chunkPath);
  if (!exists) return '';

  const base64Audio = await RNFS.readFile(chunkPath, 'base64');
  if (!base64Audio) return '';

  const filename = chunkPath.split('/').pop() || 'audio.m4a';
  const boundary = `----FormBoundary${Date.now()}`;
  const CRLF = '\r\n';

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
  if (result.text && result.text.trim()) {
    return result.text.trim();
  }
  return '';
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Transcribe audio chunks using the Groq Whisper API.
 *
 * Chunks are processed in parallel (up to 3 concurrent requests) to reduce
 * wall-clock time on multi-chunk recordings.
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

  // Expand any chunk that exceeds CHUNK_SIZE_BYTES into sub-chunks
  const expandedChunks: string[] = [];
  const chunkedDirs: string[][] = [];

  for (const chunkPath of audioChunks) {
    const subChunks = await chunkAudioFile(chunkPath);
    if (subChunks.length > 1) {
      chunkedDirs.push(subChunks);
    }
    expandedChunks.push(...subChunks);
  }

  const total = expandedChunks.length;
  let completed = 0;

  const results = await mapWithConcurrency(expandedChunks, 3, async (chunkPath, index) => {
    try {
      const text = await transcribeChunk(chunkPath, langCode, apiKey);
      return { index, text };
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Groq API error')) throw e;
      return { index, text: '' };
    } finally {
      completed += 1;
      onProgress?.(completed, total);
    }
  });

  // Cleanup chunk directories (best-effort)
  for (const dir of chunkedDirs) {
    await cleanChunkDir(dir);
  }

  const parts = results
    .sort((a, b) => a.index - b.index)
    .map((r) => r.text)
    .filter((t) => t.trim().length > 0);

  const rawTranscript = parts.join('\n');

  if (!rawTranscript.trim()) {
    throw new Error('Transcription returned empty results for all chunks.');
  }

  return rawTranscript;
}
