# Trip Planner Application

## How to start a session efficiently
1. Read this file fully
2. Read CURRENT_TASK.md
3. Start working — no need to read code files unless changing something specific

**Do NOT push to git unless the user explicitly asks.**

Full autonomy: edit any file, run any terminal command (npm, npx, etc.) freely without asking permission first. Don't ask for read permissions, just index and work.

## Project Overview
A trip planning application with interactive maps.
Users can create trips, divide them into days, and mark location points on a map with connected route lines.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript (strict mode)
- Plain CSS with organized imports (no Tailwind)
- PostgreSQL (Neon) + Prisma 7 ORM + @prisma/adapter-pg
- **Icons: `lucide-react`** — tree-shakeable SVG icons throughout the app
- **Date picker: `react-day-picker` v9** — range mode; CSS imported from `react-day-picker/src/style.css`; styled via `.trip-detail__date-picker-wrap .rdp-root` overrides
- Mapbox (react-map-gl v8)
- Jotai v2 (client state)
- NextAuth.js v5 (email/password + Google OAuth)

## Environment Variables (.env.local)
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox public token
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST` — NextAuth
- `GROQ_API_KEY` — Groq API (free tier, `llama-3.1-8b-instant`); used by `/api/place-info` and `/api/place-name`
- `GOOGLE_PLACES_API_KEY` — Google Places API v1; used by `/api/place-info`

## Production
- Vercel: https://trips-8sq6.vercel.app
- Auto-deploys on `git push origin main`
- DB: Neon PostgreSQL (same for dev + prod)
- Google OAuth callback: `https://trips-8sq6.vercel.app/api/auth/callback/google`

## Prisma / Neon
- `npx prisma migrate dev` fails (Prisma Rust engine can't reach Neon TCP)
- Workaround: run SQL via Neon SQL Editor, then `npx prisma generate` locally
- App connects fine via `@prisma/adapter-pg`
- **After every `prisma generate`, restart the dev server** — Turbopack caches the old client and won't pick up the new one otherwise

## Database Schema
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String?
  trips     Trip[]
  createdAt DateTime @default(now())
}
model Trip {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  destination String
  shareToken  String    @unique @default(cuid())
  startDate   DateTime?
  endDate     DateTime?
  days        Day[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
model Day {
  id        String          @id @default(cuid())
  tripId    String
  trip      Trip            @relation(fields: [tripId], references: [id], onDelete: Cascade)
  dayNumber Int
  summary   String?
  locations LocationPoint[]
}
model LocationPoint {
  id         String  @id @default(cuid())
  dayId      String
  day        Day     @relation(fields: [dayId], references: [id], onDelete: Cascade)
  lat        Float
  lng        Float
  orderIndex Int
  name       String
  notes      String?
  visited    Boolean @default(false)
}
```

**Live DB columns on Trip (verified):** id, userId, title, destination, createdAt, updatedAt, shareToken, startDate, endDate

**Live DB columns on LocationPoint:** id, dayId, lat, lng, orderIndex, name, notes, visited
⚠️ `visited` column requires manual SQL migration: `ALTER TABLE "LocationPoint" ADD COLUMN "visited" BOOLEAN NOT NULL DEFAULT false;`

## Jotai Store — lib/store.ts
```ts
selectedTripAtom      // Trip | null — currently open trip
selectedDayIdAtom     // string | null — currently open day
suggestedLocationAtom // SuggestedLocation | null — AI suggestion to add
focusedLocationAtom   // {lat, lng} | null — fly map to this point (consumed + cleared by MapView)
focusedLocationIdAtom // string | null — ID of selected location; drives amber highlight in list + map marker
mapClickedDestinationAtom // string | null — city name from map click → fills TripForm
routeModeAtom         // TransportMode — kept for MapView compat (legacy)
dayRouteGeoJSONAtom   // RouteGeoJSON | null — combined GeoJSON for all day segments
segmentModesAtom      // Record<string, TransportMode> — mode per segment key "${fromId}-${toId}"
segmentSummaryAtom    // Record<string, {distance, duration}> — actual route info per segment (written by DayRoute, read by location list)
dayRouteTotalAtom     // string | null — formatted total distance for open day (e.g. "4.2 km"); written by DayRoute, read by day header
```

## Key Patterns

### Map click without day selected
→ reverse geocodes to city/country level → sets `mapClickedDestinationAtom` → TripForm destination field auto-fills

### TripForm destination
Controlled input with 300ms debounced Mapbox forward geocode autocomplete (`types=place,locality,region,country`)

### Clicking a location in the list
→ sets `focusedLocationAtom` (MapView flyTo zoom 14) AND `focusedLocationIdAtom` (highlights the number badge + map marker amber)
- Clicking either the location **name button** or the **number badge** triggers both
- `focusedLocationIdAtom` is cleared when switching days (`handleDayClick`)
- Map marker gets class `map-marker--focused` (`--color-focused` amber + scale 1.18); number badge gets `.location-list__num--focused`
- focused always takes priority over visited in the class logic

### Day selected
→ MapView fitBounds to all day locations (padding 80, maxZoom 15)

### Map hint
Shows "Day X selected — click the map to add a location" when a day is open

### Trip date range (TripDetail.tsx)
- `CalendarDays` icon button in trip header shows `"May 5 – May 10"` or `"Add dates"`
- Clicking opens `react-day-picker` in `mode="range"` inline below the header
- Selecting first date = startDate, second = endDate → saved via `updateTrip(tripId, startDate, endDate)` server action
- Picker closes automatically once both dates are chosen
- Each day header shows its derived date: `startDate + (dayNumber - 1) days`

### Day header — ⋮ menu (TripDetail.tsx)
- Chevron (open/close indicator) is on the LEFT of the day name inside the header button
- A `MoreVertical` (`⋮`) button on the right opens a dropdown with: **Reorder** (when day open + ≥2 locations), **Clear locations** (when day has ≥1 location — removes all locations, keeps the day), **Delete day**
- `menuOpenDayId: string | null` state tracks which day's menu is open; closed via document click listener
- ⚠️ `.day-list__item` must NOT have `overflow: hidden` — the dropdown is absolutely positioned and would be clipped
- CSS: `.day-list__menu`, `.day-list__menu-trigger`, `.day-list__menu-dropdown`, `.day-list__menu-item`

### Routing inside each location (TripDetail.tsx)
- Route UI lives INSIDE each location item, not between locations
- **First location**: shows "Starting from…" address input (`location-list__from`) + circular info button, wrapped in `location-list__nav-row--from`
- **Other locations**: shows a route pill button + circular info button in `location-list__nav-row` → pill expands `SegmentRoutePanel` (4 mode cards)
- Segment key: `${prevLoc.id}-${loc.id}` (from previous location to this one)
- `DayRoute` component runs silently: fetches all segment data, writes to `segmentSummaryAtom` + `dayRouteGeoJSONAtom` + `dayRouteTotalAtom`, renders only the total distance/time line

### Multi-modal per-segment routing (TripDetail.tsx)
- Smart default via `suggestMode(distKm)`: <1.5km→walk, 1.5-25km→transit, >25km→drive
- User choices stored in `segmentModesAtom` (key=`${fromId}-${toId}`); never overwritten once set
- Transit: `straightLineTransitResult()` sets an instant straight-line GeoJSON; `fetchSegmentTransit()` upgrades it with walk→stop→transit→stop→walk using Overpass API + Mapbox walking
- MapView colors each segment by its `mode` property using Mapbox data-driven styling

### Place info panel (TripDetail.tsx)
- Each location has a circular `ⓘ` button (`location-list__info-circle`) next to the route pill (or "Starting from" input for first location), both wrapped in `location-list__nav-row`
- Clicking toggles `infoOpen` state → renders `LocationInfoPanel` below the nav row
- `LocationInfoPanel` calls `/api/place-info?name=&city=&lat=&lng=` which runs two parallel fetches:
  - **Google Places** (`places.googleapis.com/v1/places:searchText`): `openNow` from `currentOpeningHours`; `weekdayDescriptions` from `currentOpeningHours` with fallback to `regularOpeningHours` (they're separate — one can have openNow without weekdays); rating, price level, website. Name validation: skipped for non-ASCII names (non-Latin scripts like Hebrew won't match English displayName — trust lat/lng instead); for ASCII names, returned place must share ≥1 word (>2 chars) with search name.
  - **Groq** (`llama-3.1-8b-instant`, JSON mode, max_tokens 600): returns `{ summary, type, duration, tip }`
- Displays: type badge + duration badge → AI summary → tip → open/closed badge + rating + price → today's hours (expandable to full week) → website link → Google Maps link
- `placeInfoCache` (module-level Map, declared before `SortableLocationItem`): only caches when `ai` is not null — avoids permanently caching Groq rate-limit failures (429); user can retry by closing+reopening the panel
- `LocationInfoPanel` accepts `onDurationLoaded?: (duration: string | null) => void` — called when data arrives so the parent can show the duration hint in the nav-row
- CSS: `.location-info__ai-badges`, `.location-info__ai-badge`, `.location-info__summary`, `.location-info__tip`, `.location-info__practical`, `.location-info__open-badge`, `.location-info__rating`, `.location-info__price`, `.location-info__hours-row`, `.location-info__hours-list`, `.location-info__ext-link`, `.location-info__actions`

### Duration hint (TripDetail.tsx)
- Each location shows a small pill badge (e.g. "2–3 hours") in the nav-row, before the ⓘ button
- Sourced from the Groq AI `duration` field via `placeInfoCache`; initialized from cache on mount so it persists after panel is closed
- CSS: `.location-list__duration-hint`

### Visited toggle (TripDetail.tsx)
- `CircleCheck` button in the location row (before the delete button); `toggleLocationVisited(id, bool)` server action persists to DB
- Optimistic UI: state flips immediately, reverts on error
- When visited: number badge → `.location-list__num--visited` (`--color-success` green); map marker → `.map-marker--visited` (same green)
- focused class always takes priority over visited in the class expression

### English name badge (TripDetail.tsx)
- Rendered for ALL locations (not gated on non-ASCII) — `EnglishNameBadge` calls `/api/place-name?name=&city=` → Groq returns the standard English name (max 20 tokens, temperature 0)
- Badge renders only if the returned English name differs from the original (case-insensitive); suppresses itself for already-English names
- Module-level `englishNameCache` prevents duplicate fetches
- Layout: `location-list__name-row` (flex, align baseline, gap) wraps the name button + badge inline
- CSS: `.location-list__name-row`, `.location-list__english-name` (0.75rem, bold, gray-500)

### Day header distance sync (TripDetail.tsx)
- Day header shows `formatDistance(haversineSum)` as a fallback
- When a day is open, `DayRoute` writes its computed real routing total to `dayRouteTotalAtom` (useEffect on `totals`); clears on unmount
- Day header reads `dayRouteTotalAtom` and shows it instead for the open day → always matches the "X km · Y total" line at the bottom of the day body

### Day difficulty badge (TripDetail.tsx)
- `computeDayDifficulty(locs, segmentModes)` — walking/cycling = "active" km, driving/transit = ignored
- Thresholds: hard = activeKm > 8 OR totalKm > 50; moderate = activeKm > 3 OR totalKm > 15; easy = rest
- CSS: `.day-list__difficulty--easy/moderate/hard`

## Folder Structure
```
/app
  /actions        - addDay, addLocationPoint, createTrip, deleteDay,
                    deleteLocation, clearDayLocations, reorderLocations, updateLocation,
                    updateTrip, toggleLocationVisited, registerUser, signOutAction
  /api/auth       - NextAuth route
  /api/place-info - Server route: Google Places + Groq AI info for a location (hours, rating, summary, tip)
  /api/place-name - Server route: Groq translates a place name to standard English
  /share/[token]  - Public read-only shared trip page
  layout.tsx, page.tsx
/components
  /map            - MapView.tsx, ShareMap.tsx
  /trip           - Sidebar.tsx, TripDetail.tsx, TripList.tsx
  /ui             - AuthModal.tsx, ConfirmModal.tsx, TripForm.tsx
/lib
  db.ts, auth.ts, store.ts, utils.ts, providers.tsx
/types/index.ts
/styles
  main.css
  /setup — variables.css (full color system + --font-sans + --breakpoint-md), reset.css
  /basics — home.css (mobile-first layout), login.css
  /cmps — one file per component
/prisma/schema.prisma
```

## Features (all implemented)
1. Auth — email/password + Google OAuth
2. Create/manage trips
3. Add days with optional summary
4. Pin locations on Mapbox map (click, reorder via drag, delete)
5. Route lines per day on map — colored by transport mode
6. Notes on locations (inline editor)
7. AI "suggest next location" (Mapbox Search API)
8. Shareable read-only link `/share/[token]` — map + itinerary
9. Mobile-first responsive (map 45vh on mobile, side-by-side on desktop)
10. Onboarding hints + 3-step guide for new users
11. Map click fills destination field (city-level reverse geocode)
12. Destination autocomplete with debounce
13. Multi-modal per-segment routing — walk/cycle/drive/transit per leg, smart defaults, transit with walk-to-stop legs
14. Day difficulty badge — easy/moderate/hard pill in day header
15. Reorder locations via drag (toggle in ⋮ menu)
16. Full CSS variable system — all colors in `styles/setup/variables.css`; **zero hardcoded hex outside that file**; `--color-focused` (amber) and `--color-success` (green) used for focused/visited states
17. DM Sans font via `next/font/google`, loaded as `--font-sans` CSS variable
18. Lucide icons throughout — no emoji
19. Trip date range — `CalendarDays` button opens `react-day-picker` range picker; each day shows its derived date
20. Routing inside each location — directions UI per location item; first location has "Starting from" input
21. Day header ⋮ menu — reorder, clear locations, and delete actions in dropdown; chevron moved to left of day name; deleting a day renumbers all subsequent days
22. Location selection highlight — clicking a location name or number badge sets `focusedLocationIdAtom`; number badge turns amber, map marker turns amber + scales up
23. Place info panel — circular `ⓘ` button next to route pill; `/api/place-info` returns Google Places data (hours/rating/price) + Groq AI summary (type/duration/tip)
24. Day header distance sync — header distance badge updates to real routing total when day is open (via `dayRouteTotalAtom`)
25. English name badge — for ALL locations (not only non-ASCII), calls `/api/place-name` via Groq to show the standard English name inline in bold gray; suppresses if returned name matches original
26. Duration hint — pill badge in nav-row before ⓘ button showing AI estimated visit time; sourced from `placeInfoCache`, persists after panel closes
27. Visited toggle — `CircleCheck` button per location; persisted to DB via `toggleLocationVisited`; number badge + map marker turn green (`--color-success`) when visited

## Code Style
- Function declarations only (`function foo()` not `const foo = () =>`)
- Explicit TypeScript types, no `any`
- No inline styles in JSX
- BEM CSS class names
- Mobile-first CSS (`@media (min-width: 768px)` for desktop)
- Zod v4: use `.issues` not `.errors`
- Build script: `prisma generate && next build`

## CURRENT_TASK.md convention
- **User notes** — what to work on next
- **Claude notes** — status, decisions, suggestions
- Read at the start of every session
