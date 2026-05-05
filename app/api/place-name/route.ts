import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''
  const city = req.nextUrl.searchParams.get('city') ?? ''
  const key = process.env.GROQ_API_KEY
  if (!key || !name) return NextResponse.json({ name: null, type: null })

  const context = city ? ` in ${city}` : ''

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 40,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: `For the place "${name}"${context}, reply with JSON: {"name": "<standard English name>", "type": "<one word category like Museum, Restaurant, Park, Gallery, Market, etc.>"}`,
        },
      ],
    }),
  })

  if (!res.ok) return NextResponse.json({ name: null, type: null })
  const data = await res.json()
  const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '{}'
  try {
    const parsed = JSON.parse(raw) as { name?: string; type?: string }
    return NextResponse.json({
      name: parsed.name?.trim() ?? null,
      type: parsed.type?.trim() ?? null,
    })
  } catch {
    return NextResponse.json({ name: null, type: null })
  }
}
