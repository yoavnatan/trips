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
}
```

**Live DB columns on Trip (verified):** id, userId, title, destination, createdAt, updatedAt, shareToken, startDate, endDate

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

### Trip date range (TripDetail.tsx)
- `CalendarDays` icon button in trip header shows `"May 5 – May 10"` or `"Add dates"`
- Clicking opens `react-day-picker` in `mode="range"` inline below the header
- Selecting first date = startDate, second = endDate → saved via `updateTrip(tripId, startDate, endDate)` server action
- Picker closes automatically once both dates are chosen
- Each day header shows its derived date: `startDate + (dayNumber - 1) days`

### Day header — ⋮ menu (TripDetail.tsx)
- Chevron (open/close indicator) is on the LEFT of the day name inside the header button
- A `MoreVertical` (`⋮`) button on the right opens a dropdown with: **Reorder** (when day open + ≥2 locations) and **Delete day**
- `menuOpenDayId: string | null` state tracks which day's menu is open; closed via document click listener
- CSS: `.day-list__menu`, `.day-list__menu-trigger`, `.day-list__menu-dropdown`, `.day-list__menu-item`

### Routing inside each location (TripDetail.tsx)
- Route UI lives INSIDE each location item, not between locations
- **First location**: shows "Starting from…" address input (`location-list__from`)
- **Other locations**: shows a route pill button → expands `SegmentRoutePanel` (4 mode cards)
- Segment key: `${prevLoc.id}-${loc.id}` (from previous location to this one)
- `DayRoute` component runs silently: fetches all segment data, writes to `segmentSummaryAtom` + `dayRouteGeoJSONAtom`, renders only the total distance/time line

### Multi-modal per-segment routing (TripDetail.tsx)
- Smart default via `suggestMode(distKm)`: <1.5km→walk, 1.5-25km→transit, >25km→drive
- User choices stored in `segmentModesAtom` (key=`${fromId}-${toId}`); never overwritten once set
- Transit: `straightLineTransitResult()` sets an instant straight-line GeoJSON; `fetchSegmentTransit()` upgrades it with walk→stop→transit→stop→walk using Overpass API + Mapbox walking
- MapView colors each segment by its `mode` property using Mapbox data-driven styling

### Day difficulty badge (TripDetail.tsx)
- `computeDayDifficulty(locs, segmentModes)` — walking/cycling = "active" km, driving/transit = ignored
- Thresholds: hard = activeKm > 8 OR totalKm > 50; moderate = activeKm > 3 OR totalKm > 15; easy = rest
- CSS: `.day-list__difficulty--easy/moderate/hard`

## Folder Structure
```
/app
  /actions        - addDay, addLocationPoint, createTrip, deleteDay,
                    deleteLocation, reorderLocations, updateLocation,
                    updateTrip, registerUser, signOutAction
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
16. Full CSS variable system — all colors in `styles/setup/variables.css`
17. DM Sans font via `next/font/google`, loaded as `--font-sans` CSS variable
18. Lucide icons throughout — no emoji
19. Trip date range — `CalendarDays` button opens `react-day-picker` range picker; each day shows its derived date
20. Routing inside each location — directions UI per location item; first location has "Starting from" input
21. Day header ⋮ menu — delete + reorder actions in dropdown; chevron moved to left of day name

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
