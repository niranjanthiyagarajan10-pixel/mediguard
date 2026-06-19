"use client";

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { speak, stopSpeaking, isSpeechSupported } from "@/lib/speech";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

// A small Listen/Stop toggle for reading text aloud (elder-friendly). Renders nothing when the
// browser has no speech synthesis, so it's safe to drop anywhere. Tracks its own speaking state
// via the speak() onEnd callback (which also fires on cancel), and stops audio on unmount.
export default function SpeakButton({ text, label = "Listen", className = "" }: Props) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopSpeaking(), []);

  if (!isSpeechSupported()) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (speak(text, () => setSpeaking(false))) {
      setSpeaking(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-accent-light px-3 py-1.5 text-xs font-medium text-accent transition hover:opacity-80 ${className}`}
      aria-label={speaking ? "Stop reading aloud" : `Read aloud: ${label}`}
    >
      {speaking ? (
        <>
          <Square className="h-3.5 w-3.5" />
          Stop
        </>
      ) : (
        <>
          <Volume2 className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}
