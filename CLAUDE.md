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

## Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  trips     Trip[]
  createdAt DateTime @default(now())
}

model Trip {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  destination String
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

Example:
```typescript
// ✅ Good
function getTripById(id: string): Promise<Trip | null> {
  return prisma.trip.findUnique({ where: { id } });
}

// ❌ Bad
const getTripById = async (id) => {
  return prisma.trip.findUnique({ where: { id } });
}
```

### CSS Organization
**Main file**: `/styles/main.css`

Structure with organized imports:
```css
/* ======================
   Reset & Base
   ====================== */
@import './reset.css';
@import './base.css';
@import './variables.css';

/* ======================
   Layout
   ====================== */
@import './layout/header.css';
@import './layout/sidebar.css';
@import './layout/footer.css';

/* ======================
   Components
   ====================== */
@import './components/button.css';
@import './components/card.css';
@import './components/form.css';
@import './components/map.css';

/* ======================
   Pages
   ====================== */
@import './pages/trip.css';
@import './pages/dashboard.css';
```

**Rules**:
- No inline styles in JSX
- Each component can have its own CSS file
- All CSS files must be imported in main.css
- Keep imports organized by section with comments
- Use meaningful class names (BEM methodology preferred)

## Folder Structure

/app
/actions          - Server Actions for data mutations
/api              - API routes (if needed)
/(dashboard)      - Dashboard routes
/(trip)           - Trip-related routes
layout.tsx        - Root layout
page.tsx          - Home page
/components
/ui               - Reusable UI components
/map              - Map-related components
/trip             - Trip-specific components
/lib
/db.ts            - Prisma client instance
/utils.ts         - Helper functions
/types
/index.ts         - TypeScript interfaces and types
/styles
main.css          - Main CSS file with imports
/components       - Component-specific CSS
/layout           - Layout CSS
/pages            - Page-specific CSS
/prisma
schema.prisma     - Database schema

## Key Features
1. User authentication (future)
2. Create and manage trips
3. Add days to trips
4. Mark location points on interactive map
5. Draw route lines connecting points in order
6. Add summaries and notes to days
7. AI-powered suggestions (future)

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
- Use React Leaflet for map rendering

## Current Status

### Completed
- [x] Next.js project initialized
- [x] Prisma installed, schema defined, migration run
- [x] Neon PostgreSQL connected
- [x] Folder structure created
- [x] CSS organization set up (setup/, basics/, cmps/)
- [x] Jotai state management wired up
- [x] Main page: Mapbox map + trip creation form + trip list

### Next
- Add days to a trip
- Add location points per day on the map

## CURRENT_TASK.md convention

The file uses two sections for discussion between user and Claude:

```
## User notes
What you want to work on, questions, or tasks for Claude.

## Claude notes
Claude's response — status, suggestions, things you need to know.
```

Claude reads this at the start of every session. Update "User notes" with what you want next; Claude updates "Claude notes" with status and suggestions.