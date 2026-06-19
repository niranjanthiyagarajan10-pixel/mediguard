// Browser-native voice helpers — zero dependencies, zero Gemini quota. This is what lets the
// voice features HELP the requests-per-day budget instead of hurting it: read-aloud (TTS) and
// voice questions (STT) both run entirely in the browser.
//
// Two halves:
//   • TTS  — window.speechSynthesis, used by SpeakButton for read-aloud on key screens.
//   • STT  — the Web Speech recognition types + a single-utterance factory, used by AskChat for
//            voice Q&A. (VoiceRecorder.tsx keeps its own CONTINUOUS recognizer for dictation —
//            this is the second STT usage, which is why the shared factory lives here.)
//
// Everything is guarded for SSR (typeof window) so importing this on the server is safe.

// ---- Text-to-speech (read-aloud) -------------------------------------------------------------

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Speak text aloud, cancelling anything already speaking first. rate 0.95 is slightly slower than
// default — easier for elders to follow. onEnd fires when speech finishes OR is cancelled, so the
// caller can reset its "speaking" state. Returns true if speech started.
export function speak(text: string, onEnd?: () => void): boolean {
  if (!isSpeechSupported() || !text.trim()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  u.lang = 'en-IN'
  if (onEnd) {
    u.onend = onEnd
    u.onerror = onEnd
  }
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

// ---- Speech-to-text (voice questions) --------------------------------------------------------

// Minimal typing for the Web Speech API (not part of the TS DOM lib). Lifted from VoiceRecorder.
interface SRAlternative {
  transcript: string
}
interface SRResult {
  isFinal: boolean
  0: SRAlternative
}
export interface SREvent {
  resultIndex: number
  results: { length: number; [i: number]: SRResult }
}
export interface SpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (e: SREvent) => void
  onerror: () => void
  onend: () => void
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognition

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

// A Web Speech recognizer. Defaults to single-utterance (one phrase → onend → stop) for one-shot
// voice questions in AskChat. Easy Mode passes { continuous: true, interimResults: true } to capture
// a whole spoken visit with live text. Returns null when the browser has no Speech Recognition
// (e.g. Firefox) — callers hide the mic / show a typed fallback.
export function createRecognition(
  opts: { continuous?: boolean; interimResults?: boolean } = {}
): SpeechRecognition | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.continuous = opts.continuous ?? false
  r.interimResults = opts.interimResults ?? false
  r.lang = 'en-IN'
  return r
}
