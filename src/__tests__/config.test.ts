import { describe, it, expect } from '@jest/globals';
import { CHUNK_SIZE_BYTES, SUPPORTED_LANGUAGES, SUPPORTED_AUDIO_FORMATS, MAX_UPLOAD_SIZE_BYTES, WARN_UPLOAD_SIZE_BYTES } from '../config';

describe('config', () => {
  it('CHUNK_SIZE_BYTES is 20MB', () => {
    expect(CHUNK_SIZE_BYTES).toBe(20 * 1024 * 1024);
  });

  it('SUPPORTED_LANGUAGES contains EN and FR', () => {
    expect(SUPPORTED_LANGUAGES).toContain('EN');
    expect(SUPPORTED_LANGUAGES).toContain('FR');
  });

  it('SUPPORTED_AUDIO_FORMATS includes common formats', () => {
    expect(SUPPORTED_AUDIO_FORMATS).toContain('mp3');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('wav');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('m4a');
    expect(SUPPORTED_AUDIO_FORMATS).toContain('aac');
  });

  it('MAX_UPLOAD_SIZE_BYTES is 500MB', () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(500 * 1024 * 1024);
  });

  it('WARN_UPLOAD_SIZE_BYTES is 500MB', () => {
    expect(WARN_UPLOAD_SIZE_BYTES).toBe(500 * 1024 * 1024);
  });
});
