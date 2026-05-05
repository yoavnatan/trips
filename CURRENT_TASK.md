## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now:


1. צריך להוסיף נקודות עצירה של אוכל ולינה, האוכל יכול להיות ברשימה והלינה בסוף היום. זה צריך להיות מעט מעוצב ויפה. עם אייקונים נכונים ומיקום נכון מבחינת חוויית משתמש.

2. צריך לעשות למטה סטוק של מיקומים שאין להם יום עדיין, כמו wishlist. כשלוחצים סתם על המפה בלי יום פתוח צריכה להיות אפשרות : להוסיף ליום מסוים מהרשימה, או להוסיף לwishlist.

3. צריך לשפר את ההפרדה בין הימים כי מבחינת ui זה נראה קצת מחובר כשפותחים יום אחד לא ברור איפה הוא נגמר

next: 

-צריך הפרדה נכונה יותר בין לוקיישנים 

- מרגיש לי שצריך איזו הפרדה בין לוקיישן ללוקיישן מבחינת ui משהו עדין.

- ארגון כל הלוקיישנים ביום לפי שעות

- בסיכום של כל יום צריך להיות מחושב כמה שעות פחות או יותר שהייה לכל אתר, בתוספת המסלול שבין כל אחד מהם.

- ui יותר מעוגל, פינות מעוגלות, להוסיף אנימציות של פתיחה ושל החלפה בין מסכים וקומפוננטות.



## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### ⚠️ Vercel — להוסיף env var לפני push הבא
`MAPBOX_TOKEN` = אותו ערך כמו `NEXT_PUBLIC_MAPBOX_TOKEN` — ב-Vercel dashboard → Settings → Environment Variables

### ⚠️ DB Migration נדרש לפני שימוש
הרצה ב-Neon SQL Editor:
```sql
ALTER TABLE "LocationPoint" ADD COLUMN IF NOT EXISTS "stopType" TEXT NOT NULL DEFAULT 'place';
```
אחרי ה-SQL: `npx prisma generate` כבר בוצע. צריך רסטארט dev server.

### מה נעשה בסשן הזה
1. **עצירות אוכל / לינה** — כפתור UtensilsCrossed על כל לוקיישן; קליק מחזר: place → meal → accommodation → place; מיל קיבל רקע + border; accommodation מסופר מהרשימה ומוצג כ"Staying at" card בסוף היום עם כפתור reset
2. **הפרדה ויזואלית בין ימים** — box-shadow + z-index + margin-bottom על `.day-list__item--active`
3. **DB**: `stopType String @default("place")` ב-Prisma schema; server action `updateLocationStopType`

### להמשך (לפי עדיפות)
1. **Wishlist** — לוקיישנים ללא יום (צריך טבלה חדשה / שדה `dayId nullable`)
2. **הפרדה ויזואלית בין לוקיישנים** — divider עדין בין פריטים ברשימה
3. **ארגון לפי שעות** — הוספת שעת ביקור לכל לוקיישן, מיון לפי שעה
4. **AI summaries** — "Generate day summary" עם Claude API
5. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
6. לדאוג לסקיילביליות
