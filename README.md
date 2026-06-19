# MediGuard

**Post-visit medication safety companion.**

You've just left the doctor's office with three new prescriptions on top of two medicines you're already taking. MediGuard answers the question every patient has but rarely asks: *is this combination safe, and will I actually remember to take it?*

---

## The problem

Patients forget 40–80% of medical information before they leave the building. Medication non-adherence — driven by post-visit confusion — causes an estimated 125,000 preventable deaths annually in the US. The gap isn't access to medicine. It's the ten minutes after the prescription is written.

---

## How it works

**1. Record** your doctor visit — by voice (one tap, result read back aloud), by typing, or by uploading a prescription photo. All three paths land on an editable medicine-review screen so you can correct anything before the audit runs.

**2. Audit** with Google Gemini — drug interaction check, plain-English side effects, pharmacist questions, and a jargon glossary. Safety score (clear / caution / alert) is always at the top. Flip-card format keeps results scannable, not overwhelming.

**3. Remind** with your own calendar — dose schedules are auto-generated and exported as a standard `.ics` file. Import once into your phone's calendar; your existing alarms handle the rest.

**Also includes:** daily symptom check-ins with side-effect correlation, adherence streak tracker, cross-visit history grouped by condition, Ask-your-meds AI chat grounded in your own visit data, and **Easy Mode** — a one-tap voice flow that speaks the full safety report aloud, built for elderly users.

---

## Try the demo

Use this transcript on the Record page to see the app's headline moment:

> *"Take Aspirin 75mg once daily. Also starting Metformin 500mg twice daily after meals for 30 days. Follow up in two weeks."*

In the "Add prior prescription" field:

> *"Currently on Warfarin 5mg daily for atrial fibrillation."*

The audit will flag **Aspirin + Warfarin = HIGH interaction** (increased bleeding risk) — the safety score turns red, the interaction appears on the Aspirin card.

---

## Privacy

All data — visits, medicines, reminders, health profile, check-ins — is stored only **on your device** in IndexedDB. Nothing reaches a server we own. When you run a safety check, the visit text and medicine names are sent to Google's Gemini API for analysis; the result comes straight back to your device. Export or delete everything at any time from the Profile page.

The Gemini API key is proxied server-side via `app/api/ai/route.ts` and never ships in the client bundle.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| AI | Google Gemini API — `gemini-2.5-flash` + `gemini-2.5-flash-lite`, multi-model tiering + fallback chain |
| Vision | Gemini multimodal (prescription photo extraction) |
| Voice | Web Speech API — transcription + read-aloud, browser-native, zero API quota |
| Storage | IndexedDB via `idb` — local-first, versioned schema (v3) |
| Styling | Tailwind CSS with Apple-inspired light/dark design tokens |
| Deployment | Vercel |
| Analytics | Novus (Pendo) |

---

## Running locally

```bash
# 1. Clone
git clone https://github.com/niranjanthiyagarajan10-pixel/mediguard.git
cd mediguard

# 2. Install
npm install

# 3. Environment variables
cp .env.example .env.local
# Open .env.local and add your GEMINI_API_KEY
# Free key at https://aistudio.google.com/apikey

# 4. Run
npm run dev
# Open http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key — server-only, never sent to the browser |
| `NEXT_PUBLIC_NOVUS_APP_ID` | No | Novus analytics ID (blank = script disabled) |

---

