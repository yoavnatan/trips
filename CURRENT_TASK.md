## User notes

read claude.md allways before starting


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

### המלצות להמשך
1. **AI summaries** — כפתור "Generate day summary" שכותב תקציר אוטומטי עם Claude API
2. **PWA** — להפוך לאפליקציה שניתן להתקין על מובייל (manifest + service worker)
3. **שיפור Google OAuth** — לפתוח את ה-OAuth consent screen לכולם (כרגע רק test users)
