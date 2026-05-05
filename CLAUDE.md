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
  tripStyle   String[]  @default([])
  days        Day[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
model Day {
  id        String          @id @default(cuid())
  tripId    String
  trip      Trip            @relation(fields: [tripId], references: [id], onDelete: Cascade)
  dayNumber Int
  date      DateTime?
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
⚠️ `tripStyle` column requires manual SQL migration: `ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "tripStyle" TEXT[] DEFAULT '{}';`

**Live DB columns on Day:** id, tripId, dayNumber, date, summary
⚠️ `date` column requires manual SQL migration: `ALTER TABLE "Day" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);`

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

### URL state persistence (lib/useUrlSync.ts)
- `useUrlSync(trips)` hook, called in `Sidebar.tsx`, syncs three Jotai atoms with URL search params
- URL format: `/?trip=<tripId>&day=<dayId>&loc=<locationId>` — `day` and `loc` are omitted when not set
- **On mount**: reads URL params, validates IDs against loaded `trips` data, then sets atoms (`selectedTripAtom`, `selectedDayIdAtom`, `focusedLocationIdAtom`)
- **On atom change**: updates URL via `window.history.replaceState` (no Next.js router event, no history push)
- Single `useEffect` pattern with `initialized` ref: first run = URL → atoms (then `return`), subsequent runs = atoms → URL
- On URL restore with `loc`: also sets `focusedLocationAtom` (lat/lng looked up from trips data) so MapView flies to the location
- ⚠️ Do NOT use `router.replace` here — it triggers Next.js navigation and server re-renders; use `window.history.replaceState` instead

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

### Map overview mode (MapView.tsx)
- Default state when trip is open but no day is selected (`isOverview = !selectedDayId && !!currentTrip`)
- Shows all days' locations as colored markers (`map-marker--day-N` class, N = dayIndex % 10)
- Shows dashed straight-line GeoJSON routes per day, colored via `['get', 'color']` data-driven expression
- `DAY_COLORS` array in MapView.tsx mirrors the `--color-day-N` CSS variables in variables.css
- Clicking a marker in overview mode: sets `selectedDayIdAtom` (opens the day) + `focusedLocationIdAtom` (amber highlight) + `focusedLocationAtom` (flyTo to that location). The flyTo effect runs after the day's fitBounds effect so it wins.
- Clicking a marker in single-day mode: flyTo + sets `focusedLocationIdAtom` (no edit popup)
- `SortableLocationItem` auto-scrolls into view (`scrollIntoView({ block: 'nearest' })`) when `isFocused` becomes true
- Entering a trip: fits bounds to all locations if any exist, else flies to destination city
- Deselecting a day: also fits bounds to all locations
- **`mapLoaded` state** — separate from `mounted`; set via `onLoad` callback on `<Map>`; all map-operation effects (`fitBounds`, `flyTo`) guard on `!mapLoaded` instead of `!mounted`. This fixes URL-restore: atoms are set before Mapbox initializes, so effects must wait for the map to be truly ready, not just React-mounted.

### HomeLayout (components/HomeLayout.tsx)
- Resizable sidebar (desktop, horizontal) and map area (mobile, vertical) via pointer drag on `.home-layout__resize-handle`
- Sizes persist in `localStorage` keys `trips:sidebar-width` and `trips:map-height`; loaded on mount via `useEffect`, saved on drag end (`onPointerUp`)
- Desktop range: 360–620px sidebar; mobile map height: 15–35vh

### Day selected
→ MapView fitBounds to all day locations (padding 80, maxZoom 15)

### Map hint
Shows "Day X selected — click the map to add a location" when a day is open

### Trip date range (TripDetail.tsx)
- `CalendarDays` icon button in trip header shows `"May 5 – May 10"` or `"Add dates"`
- Clicking opens `react-day-picker` in `mode="range"` inline below the header
- Selecting first date = startDate, second = endDate → saved via `updateTrip(tripId, startDate, endDate)` server action
- Picker closes automatically once both dates are chosen

### Day header — ⋮ menu (TripDetail.tsx)
- Chevron (open/close indicator) is on the LEFT of the day name inside the header button
- A `MoreVertical` (`⋮`) button on the right opens a dropdown with: **Reorder** (when day open + ≥2 locations), **Mark all done / Unmark all** (when day has locations), **Clear locations** (when day has ≥1 location — removes all locations, keeps the day), **Delete day**
- `menuOpenDayId: string | null` state tracks which day's menu is open; closed via document click listener
- ⚠️ `.day-list__item` must NOT have `overflow: hidden` — the dropdown is absolutely positioned and would be clipped
- CSS: `.day-list__menu`, `.day-list__menu-trigger`, `.day-list__menu-dropdown`, `.day-list__menu-item`

### Per-day dates (TripDetail.tsx)
- Each day has an optional `date` field (DB: `Day.date DateTime?`)
- `sortDaysByDate(days)` helper: dated days sorted chronologically first, undated days after (preserving their relative order)
- `useEffect` on `trip.days` calls `sortDaysByDate` and auto-corrects `dayNumber` if order drifted
- `CalendarDays` icon button (`.day-list__cal-btn`) in each day header row opens an inline `react-day-picker` in `mode="single"` below the header; hidden in "Switch days" mode
- Already-used dates + dates outside trip range are disabled in the picker
- "Clear date" link below the picker clears the day's date
- Selecting a date calls `updateDayDate` server action, re-sorts list, updates `dayNumber` if order changed
- When a custom date is set: badge turns blue (`.day-list__date--custom`); calendar icon turns primary color

### Switch days (TripDetail.tsx)
- **No drag-reorder for days** — replaced by a two-step "Switch days" flow
- "Switch days" button in days header (shown when ≥2 days); `switchDaysMode: boolean`, `switchFirstDayId`, `switchSecondDayId` states
- In switch mode: circular numbered badge (`.day-list__num-badge`) appears on the left of each day header
- Click first badge → highlights blue; click second badge → both highlighted; top button becomes "Confirm swap" (filled primary)
- "Confirm swap" calls `swapDayDates` server action: swaps `date` fields between the two days (both undated → swaps `dayNumber` instead); re-sorts list optimistically; shows toast on success
- Clicking an already-selected badge deselects it; "Cancel" exits without swapping
- CSS: `.day-list__num-badge`, `.day-list__num-badge--selected`, `.trip-detail__reorder-days-btn--confirm`

### Toast notification (TripDetail.tsx)
- `toast: string | null` state; `showToast(msg)` sets it and clears after 2.8s
- Renders as `.trip-toast` — fixed, bottom-center, dark pill with check icon, slide-up animation, `pointer-events: none`

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

### English name badge + type/style tags (TripDetail.tsx)
- `EnglishNameBadge` calls `/api/place-name?name=&city=` → Groq returns `{ name, type }` JSON (max 40 tokens, JSON mode)
- Badge renders only if returned English name differs from original; fires `onTypeLoaded(type)` callback with place type
- Module-level `englishNameCache: Map<string, { name, type }>` prevents duplicate fetches
- `SortableLocationItem` initializes `locationType` state from cache on mount; also receives `tripStyles` prop
- Name row shows: name button → english name badge → `.location-list__type-badge` (gray border pill, e.g. "Museum") → `.location-list__style-tag` (blue) for each selected trip style that matches via `matchingTripStyles(type, tripStyles)`
- `matchingTripStyles`: normalizes type and STYLE_CATEGORIES values (underscore→space), checks substring overlap
- For suggestions: after Mapbox results, non-ASCII names get English name fetched in parallel; suggestion cards show type pill + matching style tags
- `SuggestedLocation` type has: `category` (search category), `poiCategories` (from Mapbox `properties.categories`), `englishName?`
- CSS: `.location-list__name-row`, `.location-list__english-name`, `.location-list__type-badge`, `.location-list__style-tag`; suggestions: `.suggest-list__name`, `.suggest-list__english`, `.suggest-list__meta`, `.suggest-list__type`, `.suggest-list__style-tag`

### Day header distance sync (TripDetail.tsx)
- Day header shows `formatDistance(haversineSum)` as a fallback
- When a day is open, `DayRoute` writes its computed real routing total to `dayRouteTotalAtom` (useEffect on `totals`); clears on unmount
- Day header reads `dayRouteTotalAtom` and shows it instead for the open day → always matches the "X km · Y total" line at the bottom of the day body

### Day difficulty badge (TripDetail.tsx)
- `computeDayDifficulty(locs, segmentModes)` — walking/cycling = "active" km, driving/transit = ignored
- Thresholds: hard = activeKm > 8 OR totalKm > 50; moderate = activeKm > 3 OR totalKm > 15; easy = rest
- CSS: `.day-list__difficulty--easy/moderate/hard`

### Day color dot (TripDetail.tsx)
- Each day header shows an 8px circle (`day-list__color-dot`) inline after "Day N", colored via `--day-color` CSS variable
- Color comes from `--color-day-N` where N = `dayIdx % 10`, matching the map overview palette
- Class `day-list__item--color-N` (N = 0–9) on the `<li>` sets `--day-color`; the dot reads it via `background-color: var(--day-color)`
- CSS: `.day-list__color-dot`, `.day-list__item--color-0` … `.day-list__item--color-9`

### Day progress circle (TripDetail.tsx)
- `DayProgressCircle({ visited, total })` — 20×20 SVG donut in the `day-list__meta` area of every day header (visible collapsed and expanded)
- Background stroke: `--color-gray-200`; fill stroke: `--color-primary` (blue), turns `--color-success` (green) when all visited
- Computed inline from `locs` — no extra state; only rendered when `locs.length > 0`
- CSS: `.day-list__progress-circle`, `.day-list__progress-bg`, `.day-list__progress-fill`, `.day-list__progress-fill--done`

### Day description / summary (TripDetail.tsx)
- `Day.summary` field (already in DB); edited inline at the top of the expanded day body
- When closed: shows summary text + "Edit description" button (pencil icon); when no summary: shows "Add description" button
- `editingSummaryDayId: string | null` + `summaryDraft: string` state in `TripDetail`
- Saving calls `updateDaySummary(dayId, summary)` server action with optimistic update to `dayItems`
- CSS: `.day-list__summary-row`, `.day-list__summary-edit-btn`, `.day-summary-editor`, `.day-summary-editor__textarea`, `.day-summary-editor__actions`, `.day-summary-editor__cancel`, `.day-summary-editor__save`

### Trip style selector (TripDetail.tsx)
- `Tag` icon button in `trip-detail__header-actions`, between date and share buttons; styled identically to `.trip-detail__date-btn`
- `tripStyles: string[]` state, initialized from `trip.tripStyle ?? []`; toggled via `handleToggleStyle` → calls `updateTripStyle` server action
- Dropdown (`trip-detail__style-dropdown`) is a vertical list that **only closes via the trigger button** (no outside-click handler) — deliberate UX
- Button label: "Trip style" (none selected) | single name (one selected) | `"Name +N"` (multiple)
- `TRIP_STYLES` constant (8 options); `STYLE_CATEGORIES` maps each style to 5 Mapbox Search categories
- `fetchNearbySuggestions` uses `STYLE_CATEGORIES` union when styles are selected, falls back to `DEFAULT_CATEGORIES`
- `geocodeDestination(destination)` — Mapbox geocoding v5 used when a day has 0 locations (no anchor point)
- "Suggest first location" shown on empty days; "Suggest next location" when day has locations
- All visited location names across every day are excluded from suggestions (`allVisited`)
- CSS: `.trip-detail__style-wrap`, `.trip-detail__style-dropdown`, `.trip-detail__style-option`, `.trip-detail__style-option--active`, `.trip-detail__date-btn--set`

### Mark all done / Unmark all (TripDetail.tsx)
- In the ⋮ menu: "Mark all done" when not all locations are visited; "Unmark all" when all are visited
- `handleMarkAllVisited(dayId, visited)` — optimistic update to `dayItems` locations, calls `markAllLocationsVisited(dayId, visited)` server action
- ⚠️ `SortableLocationItem` has local `visited` state; synced via `useEffect(() => { setVisited(loc.visited) }, [loc.visited])` so optimistic updates propagate without reopening the day

## Folder Structure
```
/app
  /actions        - addDay, addLocationPoint, createTrip, deleteDay,
                    deleteLocation, clearDayLocations, reorderLocations, reorderDays,
                    updateLocation, updateTrip, updateTripStyle, updateDayDate, swapDayDates,
                    toggleLocationVisited, markAllLocationsVisited, updateDaySummary,
                    registerUser, signOutAction
  /api/auth       - NextAuth route
  /api/place-info - Server route: Google Places + Groq AI info for a location (hours, rating, summary, tip)
  /api/place-name - Server route: Groq returns `{ name, type }` JSON — standard English name + place type (Museum, Restaurant, etc.)
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
3. Add days (no summary input — summary field removed from add-day form)
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
16. Full CSS variable system — all colors in `styles/setup/variables.css`; **zero hardcoded hex outside that file**; `--color-focused` (amber) and `--color-success` (green) used for focused/visited states; `--color-day-0` … `--color-day-9` for map overview day palette
17. DM Sans font via `next/font/google`, loaded as `--font-sans` CSS variable
18. Lucide icons throughout — no emoji
19. Trip date range — `CalendarDays` button opens `react-day-picker` range picker
20. Routing inside each location — directions UI per location item; first location has "Starting from" input
21. Day header ⋮ menu — reorder, clear locations, and delete actions in dropdown; chevron moved to left of day name; deleting a day renumbers all subsequent days
22. Location selection highlight — clicking a location name or number badge sets `focusedLocationIdAtom`; number badge turns amber, map marker turns amber + scales up
23. Place info panel — circular `ⓘ` button next to route pill; `/api/place-info` returns Google Places data (hours/rating/price) + Groq AI summary (type/duration/tip)
24. Day header distance sync — header distance badge updates to real routing total when day is open (via `dayRouteTotalAtom`)
25. English name badge + type badge — `/api/place-name` returns `{ name, type }` in one Groq call (JSON mode); `EnglishNameBadge` fires `onTypeLoaded` callback with the type; `SortableLocationItem` shows a subtle gray-bordered type pill (e.g. "Museum") and blue style tags for any selected `tripStyles` that match via `matchingTripStyles()`; `englishNameCache` stores `{ name, type }` keyed by `name|city`; `SortableLocationList` receives `tripStyles` prop passed down from `TripDetail`
26. Duration hint — pill badge in nav-row before ⓘ button showing AI estimated visit time; sourced from `placeInfoCache`, persists after panel closes
27. Visited toggle — `CircleCheck` button per location; persisted to DB via `toggleLocationVisited`; number badge + map marker turn green (`--color-success`) when visited
28. Map overview mode — when a trip is open but no day is selected, MapView shows ALL days' locations simultaneously; each day gets a color from `DAY_COLORS` (10-color palette in variables.css as `--color-day-0` … `--color-day-9`); straight-line dashed routes connect locations within each day; entering a trip auto-fits bounds to all locations; deselecting a day returns to overview
29. Per-day dates — optional `date` per day; list always sorted chronologically (`sortDaysByDate`); `CalendarDays` button per day opens inline single-date picker; already-used + out-of-range dates disabled; `updateDayDate` server action persists
30. Switch days — two-step selection of two day number badges → "Confirm swap" button appears in header; `swapDayDates` server action swaps their dates (or dayNumbers if both undated); toast confirms success
31. Trip stats summary — `trip-detail__trip-stats` (flex row) shown in the trip header below destination; displays `N days · M locations · Style1 · Style2`; selected trip styles appear as plain gray text with `·` separator inline; visible if days > 0 OR any style selected
32. Day progress circle — SVG donut in every day header showing visited/total ratio; blue → green when fully done; `DayProgressCircle` component; visible in both collapsed and expanded states
33. Day description — inline editor for `Day.summary`; "Add/Edit description" button at top of expanded day body; `updateDaySummary` server action; optimistic update
34. Mark all done — ⋮ menu item bulk-marks all day locations visited (or unvisited); `markAllLocationsVisited` server action; optimistic update propagates to `SortableLocationItem` via `useEffect` on `loc.visited`
35. Sidebar/map size persistence — `HomeLayout` saves sidebar width and map height to `localStorage` on drag end; restored on next visit (per browser, not per user)
36. Map marker selection — clicking any marker (overview or single-day mode) selects the location: sets `focusedLocationIdAtom` (amber highlight on badge + marker) and scrolls the list to that item; in overview mode also opens the day via `selectedDayIdAtom`
37. Day color dot — small 8px circle after "Day N" in each day header, colored to match that day's map color (`--color-day-N`); `day-list__item--color-N` class drives `--day-color` variable; border-left stays primary blue for the active state
38. Trip style selector — multi-select dropdown in the trip header actions row (between dates and share); options: First Time, Classic, Alternative, Adventure, Relaxed, Cultural, Culinary, Family, **Historic** (9 total); saved to `Trip.tripStyle String[]` via `updateTripStyle` action; button always shows "Trip style" (selected styles displayed in stats row instead); affects suggestion categories (`STYLE_CATEGORIES` map in TripDetail.tsx); `Historic` categories: `historic_site, monument, castle, archaeological_site, landmark`; "Suggest first location" available even on empty days (geocodes trip destination); dropdown stays open until manually toggled closed

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
