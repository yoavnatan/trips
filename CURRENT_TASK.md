## User notes

read claude.md always before starting

I want to implement a multi-modal routing feature on the current map using Next.js and Mapbox. Please perform the following:

Core Routing: Implement a navigation system that allows users to set a start and end point and visualize the route on the map.

Mapbox Integration: Use the Mapbox Directions API to handle driving, walking, and cycling profiles.

Public Transit Handling: Since Mapbox doesn't support transit natively, create a clean boilerplate function to fetch public transport data from an external API (e.g., Google Routes or Navitia) and render it as a GeoJSON layer on the Mapbox map.

UI/UX: Add a sleek, mobile-responsive selection menu to toggle between transport modes. Ensure the design follows the current app's aesthetic.

Environment Variables: Use the existing Mapbox Access Token from my .env.local file.

Safety: Do not overwrite existing map logic; integrate this as a modular feature/component.


## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### שינויים אחרונים שלא נדחפו עדיין לgit
- MapView: לחיצה על מיקום ברשימה → flyTo zoom 14 על המיקום עצמו
- MapView: בחירת יום → fitBounds לכל המיקומים של אותו יום
- MapView: לחיצה על מפה בלי יום → reverse geocode לרמת עיר/מדינה
- TripForm: destination controlled + debounced autocomplete (Mapbox geocoding)
- TripList: empty state עם 3 שלבים
- הינטים ב-TripDetail ו-Sidebar שופרו

### להמשך (לפי עדיפות)
1. **Multi-modal routing** — routes אמיתיות על כבישים (Mapbox Directions API) + toggle נהיגה/הליכה/אופניים
2. **AI summaries** — "Generate day summary" עם Claude API
3. **PWA** — התקנה על מובייל
4. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
