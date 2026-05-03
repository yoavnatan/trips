## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now: 
1. אי אפשר לפתוח את הdropdown menu כשהיום לא נבחר. צריך לתקן את זה
2. אם מוחקים יום- כל הימים שאחריו צריכים להתעדכן במספר, כלומר ללכת אחורה. צריך ל 

next: 


- צריך מצב תצוגה של כל הימים ביחד, כל המיקומים (כל יום מקבל גוון מעט שונה) ואולי גם כל הדרכים בין מיקום למיקום.
- reorder בין ימים.
-צריך שתהיה אפשרות להגדיר את מטרת הטיול, ניתן לבחור מספר אפשרויות (אלטרנטיבי, קלאסי, פעם ראשונה, וכו׳)
-כשמוסיפים יום, צריך שתהיה הצעה ליעד הראשון בהתבסס על: מה שכבר המטייל היה בו, דברים פופולריים.
- צריך שיהיה זיכרון של האתר של כמה התפריט צד פתוח אצל היוזר הזה ספציפית כדי שזה תמיד יפתח באותו האופן, כמו הגודל האחרון שהוא החליט.




## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### ⚠️ DB migration נדרשת
הרץ ב-Neon SQL Editor לפני deploy:
\`\`\`sql
ALTER TABLE "LocationPoint" ADD COLUMN "visited" BOOLEAN NOT NULL DEFAULT false;
\`\`\`

### מה נעשה בסשן האחרון
- **Duration hint** — פיל קטן לפני כפתור ⓘ עם זמן שהייה מוערך (מ-Groq); נשמר ב-cache אחרי פתיחה ראשונה
- **Visited toggle** — כפתור CircleCheck ליד כפתור המחיקה; שומר ב-DB דרך toggleLocationVisited; ספרה + מרקר במפה הופכים ירוקים (--color-success)
- **CSS cleanup** — אפס hex hardcoded מחוץ ל-variables.css; נוספו --color-focused (amber) ושימוש ב---color-success לכל visited states

### להמשך (לפי עדיפות)
1. **AI summaries** — "Generate day summary" עם Claude API
2. **PWA** — התקנה על מובייל
3. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
