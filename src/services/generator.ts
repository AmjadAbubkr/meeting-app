import { GEMINI_API_KEY } from '../config';
import type { Language } from '../store/appStore';

export async function generateReport(rawTranscript: string, language: Language) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is missing.');
  }
  if (!rawTranscript.trim()) {
    throw new Error('Transcript is empty.');
  }

  return {
    cleanedTranscript: rawTranscript,
    report: `${language} report placeholder`,
    summary: `${language} summary placeholder`,
  };
}
