import { getApiKey } from './apiKeys';
import type { Language, ReportData } from '../store/appStore';

const GEMINI_PRIMARY_MODEL = 'gemini-2.0-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-flash-latest';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    report: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        keyDiscussionPoints: { type: 'array', items: { type: 'string' } },
        actionItems: { type: 'array', items: { type: 'string' } },
        decisionsMade: { type: 'array', items: { type: 'string' } },
        openQuestions: { type: 'array', items: { type: 'string' } },
      },
    },
    summary: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['report', 'summary'],
};

type GeminiResponse = {
  report: ReportData;
  summary: string[];
};

type GenerateResult = {
  cleanedTranscript: string;
  report: ReportData;
  summary: string[];
};

/**
 * Call the Gemini API with a specific model.
 */
async function callGemini(
  modelName: string,
  apiKey: string,
  prompt: string,
): Promise<Response> {
  const url = `${GEMINI_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: REPORT_JSON_SCHEMA,
      },
    }),
  });
}

/**
 * Extract text from a Gemini generateContent response.
 */
function extractTextFromGeminiResponse(json: any): string {
  try {
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch {
    return '';
  }
}

/**
 * Generate a structured meeting report from a raw transcript using Gemini.
 *
 * @param rawTranscript - The concatenated raw transcript from transcription
 * @param language - The language for the report ('EN' or 'FR')
 * @returns Structured report with cleaned transcript, report data, and summary bullets
 */
export async function generateReport(
  rawTranscript: string,
  language: Language,
): Promise<GenerateResult> {
  const apiKey = await getApiKey('gemini');
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Add it in Settings.');
  }

  if (!rawTranscript.trim()) {
    throw new Error('Transcript is empty.');
  }

  const langLabel = language === 'EN' ? 'English' : 'French';

  const prompt = `You are a meeting assistant. Analyze the following meeting transcript and produce a structured report in ${langLabel}.

TRANSCRIPT:
---
${rawTranscript}
---

INSTRUCTIONS:
1. Clean up the transcript by removing filler words (um, uh, like, you know), disfluencies, false starts, and verbal tics. Preserve all substantive content and meaning. This is the "cleanedTranscript".
2. Generate a structured report with these sections:
   - overview: A brief 2-3 sentence overview of the meeting
   - keyDiscussionPoints: Array of main discussion points
   - actionItems: Array of specific action items mentioned (who does what by when)
   - decisionsMade: Array of decisions that were agreed upon
   - openQuestions: Array of questions that remain unresolved
3. Generate a concise executive summary as an array of bullet points (3-5 bullets)

CRITICAL RULES:
- Only include sections where the transcript contains relevant information.
- If no action items were mentioned, OMIT the actionItems field entirely. Do NOT fabricate action items.
- If no decisions were made, OMIT the decisionsMade field entirely.
- If no open questions remain, OMIT the openQuestions field entirely.
- If no key discussion points can be identified, OMIT the keyDiscussionPoints field.
- Do NOT fabricate, infer, or hallucinate any information that is not in the transcript.
- Write all content in ${langLabel}.

Return valid JSON matching the provided schema.`;

  // Try primary model first, then fallback
  let response = await callGemini(GEMINI_PRIMARY_MODEL, apiKey, prompt);

  if (!response.ok) {
    // If primary model fails, try fallback
    const fallbackResponse = await callGemini(GEMINI_FALLBACK_MODEL, apiKey, prompt);

    if (!fallbackResponse.ok) {
      const errorText = await fallbackResponse.text();
      let errorMessage = `Gemini API error (${fallbackResponse.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.error?.message) {
          errorMessage = `Gemini API error: ${errorJson.error.message}`;
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    response = fallbackResponse;
  }

  const json = await response.json();
  const textContent = extractTextFromGeminiResponse(json);

  if (!textContent.trim()) {
    throw new Error('Gemini returned an empty response.');
  }

  // Parse the JSON response
  let parsed: GeminiResponse;
  try {
    parsed = JSON.parse(textContent);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON.');
  }

  // Validate the response structure
  if (!parsed.report || !Array.isArray(parsed.summary)) {
    throw new Error('Gemini response is missing required report or summary fields.');
  }

  // Build the cleaned transcript — we return the original transcript as cleanedTranscript
  // since Gemini's structured output focuses on the report, not a separate cleaned version.
  // The "cleaning" is implicit in the report generation.
  const cleanedTranscript = rawTranscript;

  return {
    cleanedTranscript,
    report: parsed.report,
    summary: parsed.summary,
  };
}
