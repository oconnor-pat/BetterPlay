# Store launch smoke checklist (run on TestFlight / Play internal before submit)

## Builds
- [ ] iOS release build with production API
- [ ] Android release AAB signed with upload keystore (`BETTERPLAY_UPLOAD_*` in `~/.gradle/gradle.properties`)
- [ ] Backend deployed with latest auth + venue admin commits
- [ ] Secrets rotated via `BetterPlay-BE/scripts/rotate-secrets.sh` guidance

## Auth / trust
- [ ] Register → verification email → verify succeeds
- [ ] Login response has no `password` field
- [ ] Create event while logged in as user A cannot set createdBy to user B

## Venue multi-admin
- [ ] BP admin assigns venue partner (Settings → Assign venue)
- [ ] Venue owner invites staff by username
- [ ] Staff accepts banner invite
- [ ] Staff create posts as Official venue night

## First-run / tour
- [ ] New account sees permission onboarding then app tour
- [ ] Settings → How BetterPlay works replays tour
- [ ] Settings → Contact support opens mailto:betterplay.application@gmail.com

## Core product
- [ ] Create / join event, DM, group invite, report, delete account
- [ ] Push notification permission + receive test push
- [ ] Location nearby works When In Use

## Listing
- [ ] Screenshots: login, events feed, venue night, create, roster, messages (6.7" + 6.5" iPhone; phone Android)
- [ ] Privacy / Terms URLs: https://joinbetterplay.com/privacy.html and terms.html
- [ ] Support URL/email: betterplay.application@gmail.com
- [ ] Landing `appStoreUrl` / `playStoreUrl` filled after approval; redeploy Cloudflare Pages

## Cold start
- [ ] At least 1–3 venue partners assigned in launch city with upcoming nights
