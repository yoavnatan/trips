## Now

[V] npm run dev — page loads (200 OK) at http://localhost:3001

[V] Open http://localhost:3001 and verify:
    - Map renders (Mapbox)
    - "New Trip" form shows in sidebar
    - Trip list shows "No trips yet"

[V] Create a test trip via the form and confirm it appears in the list

[] Please create Atoms git commits and push it, because I didn't to it.

## Next

- Add days to a trip
- Add location points on the map

## Notes

- SSL warning from pg is harmless — no action needed
- DB: Neon PostgreSQL (eu-central-1)
- DEV_USER_ID in app/actions/createTrip.ts is a placeholder until auth is added
- Mapbox token is in .env.local
