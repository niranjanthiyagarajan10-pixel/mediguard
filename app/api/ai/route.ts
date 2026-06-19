import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

// Server-side Gemini proxy. The key lives ONLY here (process.env.GEMINI_API_KEY, no NEXT_PUBLIC_
// prefix), so it never ships in the browser bundle. lib/agents.ts POSTs { prompt, models?, image? }
// here; all prompt-building + JSON parsing stays client-side. This is the SDK plumbing that used to
// live in lib/agents.ts, moved verbatim behind the network boundary.
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

// Cache one client per model name (creating them is cheap but pointless to repeat).
const modelCache = new Map<string, ReturnType<typeof genAI.getGenerativeModel>>()
function getModel(name: string) {
  let m = modelCache.get(name)
  if (!m) {
    m = genAI.getGenerativeModel({ model: name })
    modelCache.set(name, m)
  }
  return m
}

// Only advance to the next model on errors another model could survive: quota/rate limits (429),
// a model unavailable on this account (404 / not found / not supported), or transient server errors
// (5xx / overloaded). A real bug (e.g. bad prompt) is NOT retriable — we surface it.
function isRetriable(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  return /429|too many requests|quota|rate.?limit|404|not found|not supported|unavailable|500|503|overloaded/i.test(
    msg
  )
}

type Body = {
  prompt?: string
  models?: string[]
  image?: { data: string; mimeType: string }
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'The AI service is not configured. Please set GEMINI_API_KEY on the server.' },
      { status: 500 }
    )
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { prompt, image } = body
  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt.' }, { status: 400 })
  }
  const models = body.models?.length ? body.models : ['gemini-2.5-flash']

  // One generation, with model fallback. Tries each model in order, advancing only on retriable
  // errors. Strips the markdown fences Gemini sometimes adds.
  let lastErr: unknown
  for (let i = 0; i < models.length; i++) {
    try {
      const m = getModel(models[i])
      const result = image
        ? await m.generateContent([prompt, { inlineData: image }])
        : await m.generateContent(prompt)
      const text = result.response.text().replace(/```json|```/g, '').trim()
      return NextResponse.json({ text })
    } catch (e) {
      lastErr = e
      if (i < models.length - 1 && isRetriable(e)) continue
      // Last model (or a non-retriable error): turn a raw quota 429 into one clear, actionable line;
      // otherwise return the underlying error message.
      const msg = e instanceof Error ? e.message : String(e)
      if (/429|too many requests|quota|rate.?limit/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Gemini is rate-limited (free-tier quota). Wait a minute and try again — if it keeps happening you've hit today's free limit, so use a different API key or enable billing on this one.",
          },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  return NextResponse.json({ error: msg }, { status: 502 })
}
