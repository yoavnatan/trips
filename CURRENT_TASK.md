## User notes

according to your suggestions: let's go:

please make it one by one and tell me what is done.

read claude.md allways before starting


1. Delete location / day (most urgent)
You can accidentally add a wrong location point with no way to remove it. This is a basic gap that blocks real use. A small trash icon on each location in the list + per-day delete would cover it. (Done)

2. Reorder locations within a day
Right now locations are ordered by orderIndex (insert order). Drag-to-reorder or up/down arrows would let users fix the route order without deleting and re-adding. (Done)

3. Authentication
Everything runs under a hardcoded DEV_USER_ID. If you want to actually use this app or share it, you need real login. NextAuth.js with Google OAuth is the fastest path — maybe 2-3 hours of work.
make it possible to make auth with google! 
(Done, google is not working for now)

4. Notes on locations
The schema already has a notes field on LocationPoint. Tapping a marker could open a detail panel to read/edit notes and rename the location. (Done)

5. Export / share trip
A printable day-by-day itinerary (or shareable link) would make the app feel finished.

6. Configure mobile first attitude, update the claude.md accordingly, make the app fully responsive, yet keep it simple.


## Claude notes


