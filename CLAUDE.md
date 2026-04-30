# Trip Planner Application

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
- NextAuth.js v5 (email/password auth; Google OAuth configured but not yet working)

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
  id         String @id @default(cuid())
  dayId      String
  day        Day    @relation(fields: [dayId], references: [id], onDelete: Cascade)
  lat        Float
  lng        Float
  orderIndex Int
  name       String
  notes      String?
}
```

## Prisma / Neon notes
- `npx prisma migrate dev` fails with P1001 — the Prisma Rust engine cannot reach Neon over TCP.
- Workaround: run schema changes via the **Neon SQL Editor** (console.neon.tech), then run `npx prisma generate` locally.
- The app itself connects fine via `@prisma/adapter-pg`.

## Code Style Guidelines

### Functions
- ✅ Always use function declarations: `function createTrip() {}`
- ❌ Never use const arrow functions: `const createTrip = () => {}`
- Exception: callbacks in map/filter/forEach can use arrows

### TypeScript
- ✅ Always provide explicit types
- ❌ Never use `any` type - use `unknown` if truly needed
- Create interfaces in /types folder
- Always specify function return types

### CSS Organization
**Main file**: `/styles/main.css`

Actual folder structure used:
```
/styles
  main.css
  /setup       - variables.css, reset.css
  /basics      - layout.css, home.css, login.css
  /cmps        - one file per component/page
```

**Rules**:
- No inline styles in JSX
- Mobile-first: write default styles for mobile, add `@media (min-width: 768px)` for desktop
- Breakpoint variable: `--breakpoint-md: 768px` (use literal `768px` in media queries)
- Each component has its own file in /styles/cmps/
- All CSS files must be imported in main.css
- BEM class names preferred

## Folder Structure

```
/app
  /actions        - Server Actions (addDay, addLocationPoint, createTrip, deleteDay,
                    deleteLocation, reorderLocations, updateLocation, registerUser,
                    signOutAction)
  /api/auth       - NextAuth route
  /share/[token]  - Public read-only shared trip page
  layout.tsx
  page.tsx        - Main app (map + sidebar)
/components
  /map            - MapView.tsx, ShareMap.tsx
  /trip           - Sidebar.tsx, TripDetail.tsx, TripList.tsx
  /ui             - AuthModal.tsx, ConfirmModal.tsx, TripForm.tsx
/lib
  /db.ts          - Prisma client (uses @prisma/adapter-pg)
  /auth.ts        - NextAuth config
  /store.ts       - Jotai atoms
  /utils.ts       - haversineDistance, formatDistance
  /providers.tsx  - Jotai + NextAuth providers
/types
  /index.ts       - All TypeScript interfaces
/styles
  main.css
  /setup, /basics, /cmps
/prisma
  schema.prisma
```

## Key Features (all implemented)
1. User auth — email/password registration + login. Google OAuth configured but blocked (needs OAuth consent screen approval).
2. Create and manage trips
3. Add days to trips (with optional summary)
4. Mark location points on interactive Mapbox map (click to add, drag to reorder, delete)
5. Route lines connecting points per day (dashed blue line)
6. Notes on locations (inline editor)
7. AI-powered "suggest next location" (Mapbox Search API)
8. Shareable read-only link — `/share/[token]` — map + itinerary, no login required

## Responsive / Mobile-first
- Breakpoint: 768px
- Mobile: map (45vh) stacked above scrollable sidebar
- Desktop: map (flex: 1) side-by-side with 360px sidebar
- Share page follows same pattern (40vh map on mobile)
- All components are single-column and work at any width

## Development Guidelines

### Server Actions
- Place all mutations in /app/actions
- Always use 'use server' directive
- Validate inputs with Zod
- Return typed responses

### Database Operations
- Always use try/catch for Prisma operations
- Handle errors gracefully
- Use transactions for related operations
- Include proper relations in queries

### Map Integration
- LocationPoint.orderIndex determines route line order
- Day.dayNumber starts from 1
- Update orderIndex when reordering points
- Map uses react-map-gl v8 with Mapbox Streets style

## CURRENT_TASK.md convention

The file uses two sections for discussion between user and Claude:

```
## User notes
What you want to work on, questions, or tasks for Claude.

## Claude notes
Claude's response — status, suggestions, things you need to know.
```

Claude reads this at the start of every session. Update "User notes" with what you want next; Claude updates "Claude notes" with status and suggestions.
