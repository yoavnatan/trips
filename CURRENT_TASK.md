## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in 30 minutes!

next: I want the day title marked with a difficulty level — if the average person can make the route comfortably it's "moderate", if it's hard — "hard", if it's easy — "easy".


## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### סשן אחרון — מה הושלם
- ✅ **Day difficulty badge** — easy/moderate/hard pill בכותרת ה-day
  - `computeDayDifficulty()` ב-TripDetail.tsx
  - Hard: >8km הליכה/רכיבה, או >50km כולל; Moderate: >3km או >15km; Easy: שאר
  - Fallback ל-suggestMode לימים שלא נפתחו עדיין
  - CSS: `.day-list__difficulty--easy/moderate/hard` (ירוק/צהוב/אדום)

### להמשך (לפי עדיפות)
1. **AI summaries** — "Generate day summary" עם Claude API
2. **PWA** — התקנה על מובייל
3. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
