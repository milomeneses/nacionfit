import { env } from '../env.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('GROQ_API_KEY is not configured');
    this.name = 'GroqNotConfiguredError';
  }
}

export function isGroqConfigured(): boolean {
  return env.groq.apiKey.length > 0;
}

export interface ChatChunk {
  delta?: string;
  totalTokens?: number;
}

/** Streams a chat completion, yielding text deltas and a final token count. */
export async function* streamChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): AsyncGenerator<ChatChunk> {
  if (!isGroqConfigured()) throw new GroqNotConfiguredError();

  const res = await fetch(`${env.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.groq.chatModel,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 700,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Groq chat failed (${res.status}): ${await res.text().catch(() => '')}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) yield { delta };
        if (json.usage?.total_tokens) yield { totalTokens: json.usage.total_tokens };
      } catch {
        // ignore malformed keep-alive lines
      }
    }
  }
}

/** Non-streaming completion (used for summaries). */
export async function complete(messages: ChatMessage[], maxTokens = 160): Promise<string> {
  if (!isGroqConfigured()) throw new GroqNotConfiguredError();
  const res = await fetch(`${env.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.groq.chatModel,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`Groq complete failed (${res.status})`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

/** Transcribes audio with Whisper. */
export async function transcribe(audio: Buffer, filename: string, mime: string): Promise<string> {
  if (!isGroqConfigured()) throw new GroqNotConfiguredError();
  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from(audio)], { type: mime || 'audio/webm' }), filename);
  form.append('model', env.groq.whisperModel);
  form.append('language', 'es');

  const res = await fetch(`${env.groq.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.groq.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq transcription failed (${res.status})`);
  const json = await res.json();
  return (json.text ?? '').trim();
}
