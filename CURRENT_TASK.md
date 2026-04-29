## User notes

according to your suggestions: let's go:

please make it one by one and tell me what is done.

read claude.md allways before starting/

1. Delete location / day (most urgent)
You can accidentally add a wrong location point with no way to remove it. This is a basic gap that blocks real use. A small trash icon on each location in the list + per-day delete would cover it. (Done)

2. Reorder locations within a day
Right now locations are ordered by orderIndex (insert order). Drag-to-reorder or up/down arrows would let users fix the route order without deleting and re-adding. (Done)

3. Authentication
Everything runs under a hardcoded DEV_USER_ID. If you want to actually use this app or share it, you need real login. NextAuth.js with Google OAuth is the fastest path — maybe 2-3 hours of work.
make it possible to make auth with google! 

4. Notes on locations
The schema already has a notes field on LocationPoint. Tapping a marker could open a detail panel to read/edit notes and rename the location.

5. Export / share trip
A printable day-by-day itinerary (or shareable link) would make the app feel finished.


## Claude notes

Done:
- Each day is now an accordion: click to expand/collapse
- Expanded day shows ordered location list with distance between each stop and total distance in the header badge
- "Suggest next location" button appears when a day has locations — fetches nearby POIs from Mapbox and lists them
- Clicking a suggestion flies the map to that spot and opens the add-location popup pre-filled with the name
- Created lib/utils.ts with haversineDistance + formatDistance
- Added suggestedLocationAtom to lib/store.ts for sidebar ↔ map communication

