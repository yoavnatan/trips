## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in once, work smart!

now: 
1.  צריך שהמידע אודות זמן השהייה יופיע גם לפני הסימן של הinfo.
2. רוצה ליצור סימן של ״בוצע״ כמו כאילו ״visited" כדי שנדע שהאתר בוקר. 

next: 

- אי אפשר לפתוח את הdropdown menu כשהיום לא נבחר.
- אם מוחקים יום- צריך לחשוב על מה קורה לימים שאחריו.
- צריך מצב תצוגה של כל הימים ביחד, כל המיקומים (כל יום מקבל גוון מעט שונה) ואולי גם כל הדרכים בין מיקום למיקום.
- reorder בין ימים.
-צריך שתהיה אפשרות להגדיר את מטרת הטיול, ניתן לבחור מספר אפשרויות (אלטרנטיבי, קלאסי, פעם ראשונה, וכו׳)
-כשמוסיפים יום, צריך שתהיה הצעה ליעד הראשון בהתבסס על: מה שכבר המטייל היה בו, דברים פופולריים.





## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app

### מה נעשה בסשן האחרון
- **Location selection highlight** — לחיצה על שם או מספר לוקיישן מדגישה את העיגול בכתום (`#c9903a`) ברשימה ובמפה
- **Place info panel** — כפתור עיגול `ⓘ` ליד כפתור הניווט; שולף סיכום Wikipedia (תמונה + טקסט + קישור)
- **Day header distance sync** — המרחק בכותרת היום מסתנכרן עם הסיכום האמיתי למטה דרך `dayRouteTotalAtom`

### להמשך (לפי עדיפות)
1. **עוד אפשרויות ליד ⓘ** — הוסף כפתורים נוספים ל-nav-row (e.g. Google Maps, hours, ratings)
2. **AI summaries** — "Generate day summary" עם Claude API
3. **PWA** — התקנה על מובייל
4. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
