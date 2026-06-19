"use client";

import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, Loader2, Mic } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import {
  createRecognition,
  isRecognitionSupported,
  speak,
  stopSpeaking,
  type SpeechRecognition,
} from "@/lib/speech";
import SpeakButton from "@/components/SpeakButton";

// Shared chat UI for both the per-visit (audit) and cross-visit (history) chats. The caller owns
// the actual question via `onAsk`; this component only holds the conversation and renders it.
export default function AskChat({
  title,
  subtitle,
  suggestions,
  onAsk,
}: {
  title: string;
  subtitle: string;
  suggestions: string[];
  onAsk: (question: string, history: ChatMessage[]) => Promise<string>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Detect voice support on the client only (avoids an SSR mismatch), and stop any audio or
  // listening when the chat unmounts.
  useEffect(() => {
    setSttSupported(isRecognitionSupported());
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, []);

  // fromVoice: when the question was spoken, read the answer back aloud — "speak a question, hear
  // the answer" (elder-friendly).
  const send = async (question: string, fromVoice = false) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setError("");
    // Send only the last ~6 turns so multi-turn memory stays within the free-tier budget.
    const history = messages.slice(-6);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);
    try {
      const answer = await onAsk(q, history);
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      if (fromVoice) speak(answer);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't get an answer. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // One mic tap = one question. A fresh single-utterance recognizer per tap; on the final result
  // we auto-send (with fromVoice so the answer is spoken). No auto-reopen loop.
  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (busy) return;
    const r = createRecognition();
    if (!r) return;
    recognitionRef.current = r;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      if (text) send(text, true);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-accent" />
        <h2 className="font-heading text-xl font-semibold text-text">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-text transition hover:border-accent disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-onp">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-start gap-1">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bg px-4 py-2.5 text-sm text-text">
                    {m.content}
                  </p>
                  <SpeakButton text={m.content} />
                </div>
              )
            )}
            {busy && (
              <div className="flex justify-start">
                <p className="flex items-center gap-2 rounded-2xl bg-bg px-4 py-2.5 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </p>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Type your question…"}
            className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
          />
          {sttSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              aria-label={listening ? "Stop listening" : "Ask by voice"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60 ${
                listening
                  ? "animate-pulse border-accent bg-accent-light text-accent"
                  : "border-border bg-bg text-accent hover:border-accent"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send question"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-onp transition hover:opacity-90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
