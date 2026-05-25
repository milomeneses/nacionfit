import { env } from '../env.js';

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not configured');
    this.name = 'GeminiNotConfiguredError';
  }
}

export function isGeminiConfigured(): boolean {
  return env.gemini.apiKey.length > 0;
}

/** Calls Gemini in JSON mode and returns the raw JSON string from the model. */
export async function generateJson(
  systemInstruction: string,
  userPrompt: string,
): Promise<string> {
  if (!isGeminiConfigured()) throw new GeminiNotConfiguredError();

  const url = `${env.gemini.baseUrl}/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  const json = await res.json();
  const text: string | undefined = json.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('');
  if (!text) throw new Error('Gemini returned no content');
  return text;
}
