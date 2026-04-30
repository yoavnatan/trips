## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in 30 minutes!

## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### סשן אחרון — מה הושלם
- ✅ **Reorder toggle button** — ↕ בכותרת ה-day (ליד ה-×)
  - מופיע רק כש-day פתוח ויש ≥ 2 מיקומים
  - לחיצה מציגה את ידיות הגרירה ומשנה לסימן ✓ (כחול)
  - `reorderMode` מתאפס בפתיחת day אחר
  - הוסר קוד מת: `fetchDayRoute`, `fetchTransitRoute`, `DayRouteResult`, `SegmentInfo`

### להמשך (לפי עדיפות)
1. **AI summaries** — "Generate day summary" עם Claude API
2. **PWA** — התקנה על מובייל
3. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
