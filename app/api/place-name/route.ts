import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''
  const city = req.nextUrl.searchParams.get('city') ?? ''
  const key = process.env.GROQ_API_KEY
  if (!key || !name) return NextResponse.json({ name: null })

  const context = city ? ` in ${city}` : ''

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 20,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `What is the standard English name for the place "${name}"${context}? Reply with just the English name, nothing else — no explanation, no punctuation.`,
        },
      ],
    }),
  })

  if (!res.ok) return NextResponse.json({ name: null })
  const data = await res.json()
  const englishName: string | null = data.choices?.[0]?.message?.content?.trim() ?? null
  return NextResponse.json({ name: englishName })
}
