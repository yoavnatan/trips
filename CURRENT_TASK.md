## User notes

read claude.md allways before starting

1. let's deploy


## Claude notes

### א. חיסכון בtokens — איך להשתמש בי בצורה יעילה

**הבעיה:** כל שיחה חדשה מתחילה מאפס. אם לא תגיד לי מה עשינו, אני לא יודע.

**הפתרון הכי טוב:** CLAUDE.md הוא הזיכרון הקבוע שלי. עדכנתי אותו לגמרי — הוא כולל עכשיו:
- כל הפיצ'רים שמומשו
- schema מעודכן (כולל shareToken)
- מבנה תיקיות אמיתי
- הערות Prisma/Neon
- כלל mobile-first

בתחילת כל session: תגיד לי `read CLAUDE.md` ואז תסביר מה אתה רוצה לעשות. אין צורך להסביר מה נבנה בעבר.

CURRENT_TASK.md משמש לשיחה שוטפת — User notes מה אתה רוצה, Claude notes מה שמרתי לך.

---

### ב. המלצות להמשך

**הדבר הכי שימושי עכשיו:**

1. **Google OAuth** — האפליקציה כבר מוגדרת, רק צריך OAuth consent screen ב-Google Cloud Console (15 דקות עבודה). בלי זה אנשים אמיתיים לא יכולים להירשם.

2. **Deploy לפרודקשן** — Vercel + Neon כבר עובדים ביחד מצוין. Deploy בחינם, 10 דקות עבודה. אז תוכל לשתף את הapp עם אחרים.

3. **AI summaries per day** — לכפתור "Suggest next location" יש כבר infrastructure. אפשר להוסיף "Generate day summary" שכותב תקציר של היום אוטומטית עם Claude API.

**המלצתי:** תתחיל עם Deploy — זה הדבר שהכי ישנה את החוויה שלך עם הapp.
