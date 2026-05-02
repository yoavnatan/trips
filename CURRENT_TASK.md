## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now: 
1. את דרכי ההגעה לכל לוקיישן צריך לעשות בתוך הלוקיישן עצמו ולא בין לוקיישנים. כי הרי כל לוקיישן צריך לכלול תחתיו כל מיני אפשרויות שאחת מהן תיפתח תפריט של דרכי הגעה. הלוקיישן הראשון יכלול הגעה עם שורה של כתובת מוצא.

2. צריך שיהיה לכל הטיול תאריכים, וכל יום יקבל תאריך משלו, שלמעלה בטיול יהיה אייקון של לוח שנה שיפתח לוח שנה, כמובן לא של המערכת אלא של ספריה שמתאימה פה לעיצוב.

3. צריך לשנות את האייקונים בכללי, לא אימוג׳י פשוטים אלא ממש אייקונים, תבחר מספריית אייקונים נוחה ויעילה. תעדכן בclaude.md מה בחרת

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
