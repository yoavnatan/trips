# Trip Planner Application

## How to start a session efficiently
1. Read this file fully
2. Read CURRENT_TASK.md
3. Start working — no need to read code files unless changing something specific

**Do NOT push to git unless the user explicitly asks.**

I'm giving you full permission to read any file you need to understand the broad context. Don't ask for read permissions, just index and work.

## Project Overview
A trip planning application with interactive maps.
Users can create trips, divide them into days, and mark location points on a map with connected route lines.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript (strict mode)
- Plain CSS with organized imports (no Tailwind)
- PostgreSQL (Neon) + Prisma 7 ORM + @prisma/adapter-pg
- Mapbox (react-map-gl v8)
- Jotai v2 (client state)
- NextAuth.js v5 (email/password + Google OAuth)

## Production
- Vercel: https://trips-8sq6.vercel.app
- Auto-deploys on `git push origin main`
- DB: Neon PostgreSQL (same for dev + prod)
- Google OAuth callback: `https://trips-8sq6.vercel.app/api/auth/callback/google`

## Prisma / Neon
- `npx prisma migrate dev` fails (Prisma Rust engine can't reach Neon TCP)
- Workaround: run SQL via Neon SQL Editor, then `npx prisma generate` locally
- App connects fine via `@prisma/adapter-pg`

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
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  destination String
  shareToken  String   @unique @default(cuid())
  days        Day[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
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
}
```

## Jotai Store — lib/store.ts
```ts
selectedTripAtom      // Trip | null — currently open trip
selectedDayIdAtom     // string | null — currently open day
suggestedLocationAtom // SuggestedLocation | null — AI suggestion to add
focusedLocationAtom   // {lat, lng} | null — fly map to this point
mapClickedDestinationAtom // string | null — city name from map click → fills TripForm
routeModeAtom         // TransportMode — kept for MapView compat (legacy)
dayRouteGeoJSONAtom   // RouteGeoJSON | null — combined GeoJSON for all day segments
segmentModesAtom      // Record<string, TransportMode> — mode per segment key "${fromId}-${toId}"
segmentSummaryAtom    // Record<string, {distance, duration}> — actual route info per segment (written by DayRoute, read by location list)
```

## Key Patterns

### Map click without day selected
→ reverse geocodes to city/country level → sets `mapClickedDestinationAtom` → TripForm destination field auto-fills

### TripForm destination
Controlled input with 300ms debounced Mapbox forward geocode autocomplete (`types=place,locality,region,country`)

### Clicking a location in the list
→ sets `focusedLocationAtom` → MapView flyTo zoom 14

### Day selected
→ MapView fitBounds to all day locations (padding 80, maxZoom 15)

### Map hint
Shows "Day X selected — click the map to add a location" when a day is open

### Multi-modal per-segment routing (TripDetail.tsx)
- `DayRoute` component: visual timeline below locations. Fetches all 4 modes for every segment pair in parallel on day open.
- Smart default via `suggestMode(distKm)`: <1.5km→walk, 1.5-25km→transit, >25km→drive
- User choices stored in `segmentModesAtom` (key=`${fromId}-${toId}`); never overwritten once set
- Transit: `straightLineTransitResult()` sets an instant straight-line GeoJSON; `fetchSegmentTransit()` upgrades it with walk→stop→transit→stop→walk using Overpass API (finds nearest stop) + Mapbox walking
- MapView colors each segment by its `mode` property using Mapbox data-driven styling: `['match', ['get', 'mode'], ...]`
- `DayRoute` writes fetched distances to `segmentSummaryAtom` → location list pills read from it to show actual route distance

### Day difficulty badge (TripDetail.tsx)
- `computeDayDifficulty(locs, segmentModes)` — scores each segment: walking/cycling = "active" km, driving/transit = ignored
- Thresholds: hard = activeKm > 8 OR totalKm > 50; moderate = activeKm > 3 OR totalKm > 15; easy = rest; null if < 2 locations
- Falls back to `suggestMode(distKm)` for segments where the user hasn't chosen a mode yet (i.e. unopened days)
- Renders as a color-coded pill in `day-list__meta`: green=easy, amber=moderate, red=hard
- CSS classes: `.day-list__difficulty`, `.day-list__difficulty--easy/moderate/hard`

### Route pill button (between locations)
- Pill-shaped button: `{modeIcon} {distance} · {duration} ▼`
- Shows actual route distance from `segmentSummaryAtom`, falls back to haversine `≈ X km` while loading
- Clicking opens `SegmentRoutePanel`: 4 mode cards fetched in parallel, all visible simultaneously
- Selecting a mode updates `segmentModesAtom` → DayRoute and map update reactively

## Folder Structure
```
/app
  /actions        - addDay, addLocationPoint, createTrip, deleteDay,
                    deleteLocation, reorderLocations, updateLocation,
                    registerUser, signOutAction
  /api/auth       - NextAuth route
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
  /setup — variables.css (has --breakpoint-md: 768px), reset.css
  /basics — home.css (mobile-first layout), login.css
  /cmps — one file per component
/prisma/schema.prisma
```

## Features (all implemented)
1. Auth — email/password + Google OAuth
2. Create/manage trips
3. Add days with optional summary
4. Pin locations on Mapbox map (click, drag-to-reorder, delete)
5. Dashed route lines per day
6. Notes on locations (inline editor)
7. AI "suggest next location" (Mapbox Search API)
8. Shareable read-only link `/share/[token]` — map + itinerary
9. Mobile-first responsive (map 45vh on mobile, side-by-side on desktop)
10. Onboarding hints + 3-step guide for new users
11. Map click fills destination field (city-level reverse geocode)
12. Destination autocomplete with debounce
13. Multi-modal per-segment routing — walk/cycle/drive/transit per leg, visual timeline, smart defaults, transit with walk-to-stop legs
14. Day difficulty badge — easy/moderate/hard pill shown in the day header, computed from haversine distances + transport modes

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
