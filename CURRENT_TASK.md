## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now:

1. בהצעות של הלוקיישנים צריך להציג גם את התרגום באנגלית וגם תקציר ממש קצר- מה זה המקום? מה זה ? גלריה מסעדה מוזיאון מה זה? ולהציג את הקטגוריות המתאימות לו מתוך מה שבחרנו בקטגוריות.

2. צריך להוסיף את הקטגוריות של כל מיקום, בצורה עדינה. 
next: 


- צריך להוסיף אפשרות לעצירות אוכל, איפה אני ישן.
- מרגיש לי שצריך איזו הפרדה בין לוקיישן ללוקיישן מבחינת ui משהו עדין.

- גוגל מאפס זה שולח לו מיקום ולא חיפוש מילולי, צריך לשקול לשנות זאת.





## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### ⚠️ DB migration needed
טרם ה-deploy, יש להריץ ב-Neon SQL Editor:
```sql
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "tripStyle" TEXT[] DEFAULT '{}';
```

### איך הצעות מיקום עובדות (task 4)
הצעות ל"Suggest next/first location" מגיעות מ-**Mapbox Search API**:
- Endpoint: `https://api.mapbox.com/search/searchbox/v1/category/{category}?proximity={lng},{lat}&limit=3`
- קטגוריות ברירת מחדל: `tourist_attraction, historic_site, art_gallery, viewpoint, museum`
- **עכשיו**: קטגוריות משתנות לפי אופי הטיול שנבחר (`STYLE_CATEGORIES` ב-TripDetail.tsx)
- המיקום הוא הlat/lng של המיקום האחרון; אם אין מיקומים ביום — geocode של יעד הטיול (Mapbox geocoding v5)
- שמות שכבר נראו (`seenNames`) + כל המיקומים בכל הימים (`allVisited`) מסוננים

### מה נעשה (tasks 1-3)
1. **אופי טיול** — שורת תגיות בין הכותרת לימים (First Time / Classic / Alternative / Adventure / Relaxed / Cultural / Culinary / Family)
   - שמור ב-DB: `Trip.tripStyle String[]` — צריך migration לעיל
   - action: `updateTripStyle.ts`
2. **הצעה ליום ריק** — "Suggest first location" מופיע גם כשאין מיקומים (geocode יעד הטיול)
3. **הצעות תואמות אופי** — קטגוריות משתנות לפי הסגנונות שנבחרו

### להמשך (לפי עדיפות)
1. **עוד אפשרויות ליד ⓘ** — הוסף כפתורים נוספים ל-nav-row
2. **AI summaries** — "Generate day summary" עם Claude API
3. **PWA** — התקנה על מובייל
4. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
