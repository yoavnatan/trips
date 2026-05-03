## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now: 

next: 
- צריך מצב תצוגה של כל הימים ביחד, כל המיקומים (כל יום מקבל גוון מעט שונה) ואולי גם כל הדרכים בין מיקום למיקום.
- reorder בין ימים.
- צריך שתהיה אפשרות להגדיר את מטרת הטיול, ניתן לבחור מספר אפשרויות (אלטרנטיבי, קלאסי, פעם ראשונה, וכו׳)
- כשמוסיפים יום, צריך שתהיה הצעה ליעד הראשון בהתבסס על: מה שכבר המטייל היה בו, דברים פופולריים.
- צריך שיהיה זיכרון של האתר של כמה התפריט צד פתוח אצל היוזר הזה ספציפית כדי שזה תמיד יפתח באותו האופן, כמו הגודל האחרון שהוא החליט.
- צריך להוסיף אפשרות לעצירות אוכל, איפה אני ישן.


## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### ⚠️ DB migration נדרשת (visited column)
הרץ ב-Neon SQL Editor לפני deploy:
```sql
ALTER TABLE "LocationPoint" ADD COLUMN "visited" BOOLEAN NOT NULL DEFAULT false;
```

### מה נעשה בסשן האחרון
- **Bug fix: dropdown menu** — הוסר `overflow: hidden` מ-`.day-list__item` שחסם את הדרופדאון כשהיום לא נבחר
- **Bug fix: מחיקת יום** — `deleteDay` מעכשיו מעדכן `dayNumber` לכל הימים שאחרי (decrement בDB)
- **Clear locations** — אפשרות חדשה בתפריט ⋮ של כל יום; מוחקת את כל הלוקיישנים ומשאירה את היום; action חדש `clearDayLocations.ts`

### להמשך (לפי עדיפות)
1. **AI summaries** — "Generate day summary" עם Claude API
2. **PWA** — התקנה על מובייל
3. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
