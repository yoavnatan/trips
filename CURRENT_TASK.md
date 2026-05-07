## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now:

1. **הפרדה ויזואלית בין לוקיישנים** — divider עדין בין פריטים ברשימה

2. **Wishlist** — לוקיישנים ללא יום. כשלוחצים על המפה בלי יום פתוח: אפשרות להוסיף ליום מסוים מהרשימה, או להוסיף לwishlist.

3. **שיפור suggest meal** — להציג סימוני אוכל על המפה כשמציגים הצעות, כדי שהמשתמש יראה איפה ההצעות ממוקמות.

next:

- ארגון כל הלוקיישנים ביום לפי שעות (הוספת שעת ביקור, מיון לפי שעה)
- בסיכום יום: כמה שעות שהייה לכל אתר + מסלול בין כל אחד
- ui יותר מעוגל, פינות מעוגלות, אנימציות פתיחה/החלפה בין קומפוננטות
- hover UI על דברים
- Loader למפה
- Google OAuth consent screen — לפתוח לכולם


## Claude notes

### סטטוס — עובד בפרודקשן
https://trips-8sq6.vercel.app
כל env vars מוגדרים ב-Vercel (כולל DATABASE_URL, MAPBOX_TOKEN, GROQ_API_KEY, GOOGLE_PLACES_API_KEY).
Google OAuth עובד. אין הערות פתוחות.

### DB — כל מיגרציות הורצו
stopType, visited, date, tripStyle — הכל קיים ב-Neon. לא נדרשת מיגרציה לסשן הבא.

### מה נעשה בסשן האחרון
1. **stopType על LocationPoint** — place/meal/accommodation; meal inline עם amber border; accommodation כ-"Staying at" card בסוף היום; updateLocationStopType server action
2. **Suggest meal** — כפתור בגוף היום; mealCacheRef (useRef Map) — תוצאות שורדות סגירה/פתיחה מחדש
3. **צבעי ימים יציבים** — dayColorIndex(id) ב-lib/utils.ts (hash של ID, לא position); TripDetail + MapView משתמשים באותה פונקציה
4. **Server-side API proxies** — /api/mapbox/geocode|reverse|suggest|directions + /api/overpass/stop; token לא יוצא ב-client bundle
5. **Overpass 429 fix** — server cache 1h + client transitStopInFlight dedup (מונע React StrictMode כפול)
6. **Bug fixes** — Starting from input width; dashed border על suggest btn; difficulty badge עם location אחד
7. **Vercel auth** — Google OAuth עובד; כל env vars מוגדרים

### להמשך (לפי עדיפות)
1. הפרדה ויזואלית בין לוקיישנים (divider עדין)
2. Wishlist
3. Suggest meal markers על מפה
4. שעות לוקיישן + מיון
5. UI עיגולים + אנימציות
