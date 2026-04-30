## User notes

read claude.md allways before starting

1. I want to get more comprehensive user experience, suggest how to improve the ux, consider the user needs to be able to plan a trip, without necceserely previews knowladge.

2. "I want to implement a multi-modal routing feature on the current map using Next.js and Mapbox. Please perform the following:

Core Routing: Implement a navigation system that allows users to set a start and end point and visualize the route on the map.

Mapbox Integration: Use the Mapbox Directions API to handle driving, walking, and cycling profiles.

Public Transit Handling: Since Mapbox doesn't support transit natively, create a clean boilerplate function to fetch public transport data from an external API (e.g., Google Routes or Navitia) and render it as a GeoJSON layer on the Mapbox map.

UI/UX: Add a sleek, mobile-responsive selection menu to toggle between transport modes. Ensure the design follows the current app's aesthetic.

Environment Variables: Use the existing Mapbox Access Token from my .env.local file.

Safety: Do not overwrite existing map logic; integrate this as a modular feature/component."

## Claude notes

### סטטוס
הכל בוצע. האפליקציה בפרודקשן: https://trips-8sq6.vercel.app

### מה נבנה (סיכום)
1. מחיקת location/day ✅
2. גרירה לסידור מחדש ✅
3. Authentication (email/password + Google OAuth) ✅
4. Notes על locations ✅
5. Shareable link (`/share/[token]`) ✅
6. Mobile-first responsive layout ✅
7. Deploy ל-Vercel ✅

### בביצוע עכשיו
UX improvements (task 1):
- Empty state ידידותי כשאין טיולים
- Onboarding hints ברורים (צור טיול → בחר יום → לחץ מפה)
- שיפור פלואו כללי למשתמש חדש

### המלצות להמשך
1. **Multi-modal routing** (task 2) — routes אמיתיות על כבישים עם Mapbox Directions API + toggle נהיגה/הליכה/אופניים
2. **AI summaries** — כפתור "Generate day summary" עם Claude API
3. **PWA** — התקנה על מובייל (manifest + service worker)
4. **שיפור Google OAuth** — לפתוח את ה-OAuth consent screen לכולם
