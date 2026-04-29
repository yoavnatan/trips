## User notes

-make the locations every day become a list, 
put a distance between each one, and summary of distance between all.
every day can be open up in an accordion. 

-suggest next location in the list, if clicked, pin it on the map.

-allayws read claude.md before work.


## Claude notes

Done:
- Each day is now an accordion: click to expand/collapse
- Expanded day shows ordered location list with distance between each stop and total distance in the header badge
- "Suggest next location" button appears when a day has locations — fetches nearby POIs from Mapbox and lists them
- Clicking a suggestion flies the map to that spot and opens the add-location popup pre-filled with the name
- Created lib/utils.ts with haversineDistance + formatDistance
- Added suggestedLocationAtom to lib/store.ts for sidebar ↔ map communication

