"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Square, AlertCircle } from "lucide-react";

// Minimal typing for the Web Speech API (not part of the TS DOM lib)
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: SREvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;

type Props = {
  transcript: string;
  onFinal: (chunk: string) => void;
};

export default function VoiceRecorder({ transcript, onFinal }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(onFinal);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the latest callback reachable from the long-lived recognition handler
  onFinalRef.current = onFinal;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current(r[0].transcript);
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => {
      setRecording(false);
      setInterim("");
    };
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [transcript, interim]);

  if (!supported) {
    return (
      <div className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="font-medium text-text">
            Voice recording isn&rsquo;t supported in this browser.
          </p>
          <p className="mt-1 text-muted">
            Please use Chrome or Edge on desktop to record your visit.
          </p>
        </div>
      </div>
    );
  }

  const toggle = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (recording) {
      r.stop();
      setRecording(false);
    } else {
      setInterim("");
      try {
        r.start();
        setRecording(true);
      } catch {
        // start() throws if already running — ignore
      }
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {recording && (
          <motion.span
            className="absolute h-24 w-24 rounded-full bg-primary"
            animate={{ scale: [1, 1.5], opacity: [0.35, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
        <motion.button
          type="button"
          onClick={toggle}
          animate={recording ? { scale: [1, 1.15, 1] } : { scale: 1 }}
          transition={
            recording
              ? { duration: 1.2, repeat: Infinity }
              : { duration: 0.2 }
          }
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-primary text-onp shadow-lg"
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square className="h-8 w-8" /> : <Mic className="h-9 w-9" />}
        </motion.button>
      </div>
      <p className="mt-4 text-sm text-muted">
        {recording ? "Recording… tap to stop" : "Tap to start recording"}
      </p>
      <div
        ref={boxRef}
        className="mt-6 max-h-48 min-h-[120px] w-full overflow-y-auto rounded-xl border border-border bg-surface p-4 leading-relaxed"
      >
        {transcript || interim ? (
          <p>
            <span className="text-text">{transcript}</span>{" "}
            <span className="text-muted">{interim}</span>
          </p>
        ) : (
          <p className="text-muted">Your words will appear here as you speak…</p>
        )}
      </div>
    </div>
  );
}
