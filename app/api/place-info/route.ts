import { NextRequest, NextResponse } from 'next/server'

type GoogleResult = {
  openNow: boolean | null
  todayHours: string | null
  weekdayDescriptions: string[] | null
  rating: number | null
  priceLevel: string | null
  website: string | null
}

type AIResult = {
  summary: string
  type?: string
  duration?: string
  tip?: string
}

async function fetchGooglePlaces(name: string, city: string, lat: number, lng: number): Promise<GoogleResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return null

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.currentOpeningHours,places.regularOpeningHours,places.rating,places.priceLevel,places.websiteUri',
    },
    body: JSON.stringify({
      textQuery: `${name}${city ? ` ${city}` : ''}`,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 1000 },
      },
      maxResultCount: 1,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const place = data.places?.[0]
  if (!place) return null

  // Discard result if the returned place name shares no words with our search name.
  // Skip this check for non-Latin names (Hebrew, Arabic, Japanese, etc.) — the words
  // won't match an English displayName, so we trust the lat/lng location bias instead.
  const hasNonAscii = name.split('').some((ch) => (ch.codePointAt(0) ?? 0) > 0x007e)
  if (!hasNonAscii) {
    const returnedName: string = place.displayName?.text?.toLowerCase() ?? ''
    const searchWords = name.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const nameMatches = searchWords.length === 0 || searchWords.some((w) => returnedName.includes(w))
    if (!nameMatches) return null
  }

  const currentHours = place.currentOpeningHours ?? null
  const regularHours = place.regularOpeningHours ?? null
  // openNow comes from currentOpeningHours; weekdayDescriptions can be on either
  const openNow = currentHours?.openNow ?? null
  const weekdays: string[] | null =
    currentHours?.weekdayDescriptions ?? regularHours?.weekdayDescriptions ?? null
  const dayIndex = new Date().getDay()
  const googleIndex = dayIndex === 0 ? 6 : dayIndex - 1
  const todayHours = weekdays ? (weekdays[googleIndex] ?? null) : null

  return {
    openNow,
    todayHours,
    weekdayDescriptions: weekdays,
    rating: place.rating ?? null,
    priceLevel: place.priceLevel ?? null,
    website: place.websiteUri ?? null,
  }
}

async function fetchAIInfo(name: string, city: string): Promise<AIResult | null> {
  const key = process.env.GROQ_API_KEY
  if (!key) return null

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `You are a travel guide. For the tourist attraction or place named "${name}"${city ? ` in ${city}` : ''}, respond in JSON with these fields:
- "summary": 2–3 sentences explaining what it is and why it's worth visiting
- "type": short category label (e.g. "Museum", "Historic Site", "Park", "Temple", "Market", "Restaurant")
- "duration": recommended visit duration (e.g. "1–2 hours", "30 minutes", "Half day")
- "tip": one practical tip for visitors (entry advice, best time to visit, what to bring, etc.)

Return only valid JSON, no markdown, no extra text.`,
        },
      ],
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const text: string | undefined = data.choices?.[0]?.message?.content
  if (!text) return null

  try {
    const parsed = JSON.parse(text) as Partial<AIResult>
    if (!parsed.summary) return null
    return {
      summary: parsed.summary,
      type: parsed.type,
      duration: parsed.duration,
      tip: parsed.tip,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const name = searchParams.get('name') ?? ''
  const city = searchParams.get('city') ?? ''
  const lat = parseFloat(searchParams.get('lat') ?? '0')
  const lng = parseFloat(searchParams.get('lng') ?? '0')

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const [googleSettled, aiSettled] = await Promise.allSettled([
    fetchGooglePlaces(name, city, lat, lng),
    fetchAIInfo(name, city),
  ])

  return NextResponse.json({
    google: googleSettled.status === 'fulfilled' ? googleSettled.value : null,
    ai: aiSettled.status === 'fulfilled' ? aiSettled.value : null,
  })
}
