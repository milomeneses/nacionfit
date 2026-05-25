import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { CoachConversation, CoachMessage } from '@nacionfit/shared';
import {
  createConversation,
  getCoachMessages,
  listConversations,
  streamCoachMessage,
  transcribeVoice,
} from '../lib/api';
import { fmtTimeAgo } from '../lib/cravings';

function renderContent(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
      <em key={i} className="font-display italic text-green">
        {part.slice(1, -1)}
      </em>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface LocalMessage {
  id: number;
  role: CoachMessage['role'];
  content: string;
}

export function Coach() {
  const [conversations, setConversations] = useState<CoachConversation[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    listConversations().then(async (list) => {
      setConversations(list);
      if (list.length > 0) {
        setActiveId(list[0].id);
        setMessages(await getCoachMessages(list[0].id));
      }
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function selectConversation(id: number) {
    setActiveId(id);
    setMenuOpen(false);
    setError(null);
    setMessages(await getCoachMessages(id));
  }

  async function newConversation(): Promise<number> {
    const conv = await createConversation();
    setConversations((prev) => [conv, ...(prev ?? [])]);
    setActiveId(conv.id);
    setMessages([]);
    setMenuOpen(false);
    return conv.id;
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;
    setError(null);
    setInput('');

    let convId = activeId;
    if (convId == null) convId = await newConversation();

    const userMsg: LocalMessage = { id: Date.now(), role: 'user', content };
    const assistantMsg: LocalMessage = { id: Date.now() + 1, role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      await streamCoachMessage(convId, content, (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m)),
        );
      });
      // refresh summaries (a summary may have been generated)
      listConversations().then(setConversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'El coach no respondió.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setStreaming(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => ev.data.size > 0 && chunksRef.current.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setTranscribing(true);
        try {
          const text = await transcribeVoice(blob);
          setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch {
          setError('No se pudo transcribir el audio.');
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('No pudimos acceder al micrófono.');
    }
  }

  const showEmpty = conversations != null && conversations.length === 0 && messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl leading-tight text-green">
          Tu <span className="italic text-terra">coach</span>
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-ink transition hover:bg-bg"
            >
              Conversaciones
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 max-h-80 w-72 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
                {conversations && conversations.length > 0 ? (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={`block w-full rounded-lg px-3 py-2 text-left font-body text-sm transition hover:bg-bg ${
                        c.id === activeId ? 'bg-green-pale' : ''
                      }`}
                    >
                      <span className="block text-ink">
                        {c.summary ?? 'Conversación sin resumen'}
                      </span>
                      <span className="block text-xs text-ink/40">
                        {fmtTimeAgo(c.lastMessageAt)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 font-body text-sm text-ink/50">Sin conversaciones</p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={newConversation}
            className="rounded-md border border-green bg-green px-3 py-1.5 font-body text-sm text-surface transition hover:bg-green/90"
          >
            Nueva
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface/40 p-4"
      >
        {showEmpty ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="font-display text-xl italic leading-relaxed text-green">
              Empezá una conversación con tu coach.
            </p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-terra px-4 py-2.5 font-body text-surface">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-2.5 font-body text-ink">
                  {m.content ? (
                    renderContent(m.content)
                  ) : (
                    <span className="text-ink/40">…</span>
                  )}
                </div>
              </div>
            ),
          )
        )}
      </div>

      {error && <p className="mt-2 font-body text-sm text-terra">{error}</p>}

      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={transcribing}
          aria-label={recording ? 'Detener grabación' : 'Grabar audio'}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition ${
            recording
              ? 'border-terra bg-terra text-surface'
              : 'border-line bg-surface text-ink hover:border-green/40'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={transcribing ? 'Transcribiendo…' : 'Escribí tu mensaje…'}
          disabled={streaming}
          className="h-11 flex-1 rounded-lg border border-line bg-bg px-4 font-body text-ink placeholder:text-ink/30 outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="h-11 shrink-0 rounded-lg bg-green px-5 font-body font-medium text-surface transition hover:bg-green/90 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
