## User notes

read claude.md always before starting.
save usage in terms of claude tokens.
don't waste all the tokens in 30 minutes!

current : 
we are now working on the route methods from locations. (multi-modal routing)
1. improve the transopration method like that:
the user can click on the distance itself between two locations on the list and get the route and the options to change the method. the distance would be computed depends on the route method. the distance should reflect the actual distance the user would pass, not the "air distance". 
2. I don't like the idea it automaitaclly choose busses, most of the people like to divereify the way they use transoprtaoin, with metros, busses etc. it should be intuitive to move from optiions, think like a lost tourist. someone who want to have all the options infront of him before he travels. 

next: I want the day title marked with a difficulty level, if the avarage person can make the route with peace it would be a moderate level, if it's hard- hard, if it's an easy day it would be easy peasy. 


## Claude notes

### סטטוס — הכל עובד בפרודקשן
https://trips-8sq6.vercel.app


### להמשך (לפי עדיפות)
1. **Multi-modal routing** — routes אמיתיות על כבישים (Mapbox Directions API) + toggle נהיגה/הליכה/אופניים
2. **AI summaries** — "Generate day summary" עם Claude API
3. **PWA** — התקנה על מובייל
4. **Google OAuth** — לפתוח לכולם (OAuth consent screen)
