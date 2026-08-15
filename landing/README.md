# Cloudflare Pages — quick deploy for joinbetterplay.com

This folder is a static site. Point Cloudflare Pages at it (or upload the folder).

## 1. Fill in your beta links

Edit `index.html` and set:

```js
window.BETTERPLAY_LINKS = {
  testFlightUrl: "https://testflight.apple.com/join/YOUR_CODE",
  firebaseUrl: "https://appdistribution.firebase.google.com/...",
  testerEmail: "hello@joinbetterplay.com",
};
```

- **TestFlight public link:** App Store Connect → your app → TestFlight → Public Link  
- **Firebase:** Firebase Console → App Distribution → get an invite / tester link  

If a link is empty, that platform shows an email fallback instead.

## 2. Deploy on Cloudflare

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**
2. Connect the BetterPlay GitHub repo, **or** use “Upload assets” and drag this `landing/` folder
3. If connecting the repo: set **Root directory** to `landing`, build command empty / `exit 0`, output directory `.` or `landing`
4. Custom domain: add `joinbetterplay.com` (and `www` if you want) in Pages → Custom domains

## 3. What share links look like

The app shares:

`https://joinbetterplay.com/?e=<eventId>&name=<eventName>`

People without the app see Get iOS / Get Android. People who already have it can tap “Open this event in the app” (`betterplay://event/<id>`).
