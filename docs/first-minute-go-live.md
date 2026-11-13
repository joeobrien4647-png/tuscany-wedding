# The invitation: going live

The new invitation is built on the `first-minute` branch and ships switched off. Nothing below has been run. Do the sections in order. Sections marked **Joe only** change the live database or the live site and must not be done by anyone else.

The order matters. The code goes live first with the switch off, so guests see no change, and only then is it tried for real on two phones. The switch is flipped last.

Before you start:

- The switch is `data-first-enabled` on the `optional-head` script in `index.html`. It is `"false"`.
- A preview never needs the switch: add `&first=1` to a personal link. `&first=0` forces the old site.
- `?signin=1` always shows the old sign-in, switch or no switch. The dashboard is unchanged apart from the new Invitations section in the Site tab.

## 1. Publish the database rules (Joe only)

The branch adds one block, `household`, to `firebase.rules.json`. Nothing else in the file changes compared with the published site's copy.

1. Firebase console, Realtime Database, Rules tab. Copy what is live now into a file you keep (your way back).
2. Compare the live rules with `firebase.rules.json` on `main`. If they differ, stop and work out why before going on: pasting the branch's file would overwrite the difference.
3. Paste the branch's `firebase.rules.json` and publish.

What the new block allows: anyone holding a personal link can read and write that one household's reply and stay choice. Nobody without the link can read it, and nobody but a signed-in admin can list households. Replies close at the end of Sunday 28 February 2027. A stay choice needs a yes first.

Not yet proven: these rules have only been checked for shape by the tests. Section 4 is the real proof that they accept a reply. To see a refusal now, use the Rules Playground on the same tab: a read of `/household` with no sign-in should be denied.

## 2. Make and import the invitation list (Joe only)

The tool is `tools/faces_welcome.py` in the `tuscany-welcome-video` repo. Its steps are in that repo's `docs/LAUNCH.md` (the sections on publishing the rules and importing `/welcome`).

- Each household needs `display`, `lines` and `people` under `welcome/<key>`. `people` is what the reply screen lists, in order. Eight people at most per household.
- Import at the `welcome` node only, never at the database root.
- The private list of links stays out of this repo.

If `welcome` is already imported and current, there is nothing to do here.

## 3. Push with the switch still off (Joe only)

Merge `first-minute` into `main` and push, with `data-first-enabled="false"` exactly as the branch has it. GitHub Pages publishes within a few minutes.

Check: open the site as a guest would. It should look and behave exactly as it did before. The new invitation only appears with `&first=1`.

## 4. Try it for real on two phones

1. Pick the link to test with. Best is your own household's link if the list has one. If you use a guest's link, add `&test=1` so it is not counted as opened by them.
2. Add `&first=1` and open it on Joe's phone and Sophie's phone. Sound on. Watch the whole minute once.
3. Reply yes, pick who is coming, choose a place to stay, open each card.
4. In the dashboard, Site tab, Invitations: the household should show the reply and the stay choice. (It shows as opened only if you did not use `&test=1`.)
5. From that row, set the household to "Can't come" by hand, then press Clear. Both should work without an error message. This is the one dashboard action that has not been run against the real rules: if Clear shows "Not done", stop and say so before inviting anyone.
6. On each phone, open the Reply card and tap "Not you?" so the phone forgets the test invitation.

This is the first time it will have been seen or heard on a real phone. Things to look for: nothing cut off, nothing that scrolls, the music starts after the first tap and the sound button works, the video plays, the countdown is right.

Optional, on a computer with Python and Playwright installed and a network connection: `python scripts/check-first-fit.py` runs every screen on four phone setups and stops with an error if anything is cut off. It takes about twelve minutes.

## 4a. The Getting there card

Built on the `getting-there` branch, on top of sections 1 to 4, which were done on 11 Nov 2026. Nothing in this section has been run. The card sits behind the same switch, so guests see nothing until section 6.

What it adds: a guest builds their trip on a map, fills a ticket and stamps it. A stamped ticket is saved at `travel/<their key>/<ticket number>`, where a personal link can write but never read. Only a signed-in admin can read it, so guests cannot see each other's plans. The phone that stamped a ticket keeps its own copy and shows it again; another phone starts empty.

**Publish the rules (Joe only).** The branch adds one block, `travel`, to `firebase.rules.json`, beside `household`. Nothing else in the file changes.

1. Firebase console, Realtime Database, Rules tab. Copy what is live now into a file you keep (your way back).
2. Compare the live rules with `firebase.rules.json` on `main`. They should match what you published on 11 Nov. If they differ, stop and work out why first.
3. Paste the `getting-there` branch's `firebase.rules.json` and publish.
4. Check a link cannot read tickets: in the Rules Playground, a read of `/travel` and of `/travel/anything` with no sign-in should both be denied.
5. Check a household with no yes cannot stamp: in the Rules Playground, a set at `/travel/<a key with no reply>/0` with no sign-in should be denied.
6. Two more that should be denied, using a key that has replied yes: a read of `/travel/<that key>/0`, and a set at `/travel/<that key>/8` (there are only eight tickets, 0 to 7).

Not yet proven: the rules have only been checked for shape by the tests. That they accept a real stamp is proven by the two-phone test below, and by nothing before it. Until the rules are published, stamping on the live site fails with "Could not stamp it" and nothing is lost.

**Push with the switch still off (Joe only).** Merge `getting-there` into `main` and push, as in section 3. The site should look exactly as before.

**Try it on two phones.**

1. Use your own household's link with `&first=1&test=1`, on both phones.
2. Open Travel. Pick London and Manchester, compare, choose a route, pick the last stretch and the days, stamp. The Travel button on the home screen should tick gold.
3. Close the card and open it again: the stamped ticket should still be there. On the second phone the card starts empty: that is by design.
4. Tap "Someone travelling separately?", pick one of you, build a second ticket and stamp it.
5. Try the other ways of setting off (outside the UK, already in Italy, driving, train), "Flying with a change?" and "Landing somewhere else?". You do not need to stamp these.
6. In the dashboard, Site tab, Invitations: your household's row should show a "Travel" line for each ticket, and an Arrivals list underneath.
7. Things to look for on a real phone: nothing cut off, only the list at the bottom scrolls, the map moves smoothly, typing an airport name does not hide the box behind the keyboard.

**Clear the test tickets (Joe only).** The dashboard shows tickets but does not change them. In the Firebase console, Realtime Database, Data tab, open `travel`, find your household's key and delete that one entry. Never delete `travel` itself once guests have stamped. Then on each phone open the Reply card and tap "Not you?", which also forgets the ticket kept on that phone.

Not in yet: prices on the routes. The "See live prices" link works now and opens Google Flights for the chosen route and days. Prices shown on the card come in January, and need a SerpApi account and key that only Joe can create.

## 5. Write the words

Every guest-facing line is in `js/first/words.js` and every one is a placeholder. Replace them with your own. The Getting there card's lines are under `travel`; its airports, airlines, drive times and tolls are not words, they come from `data/getting-there.json`. Ones that need a decision, not just wording:

- The gifts answer (it says details will follow)
- The line under "your own place"
- The weekend lines for each day
- "Nearly ready" (shown when an envelope's date has passed but nothing is inside yet) and "Today" (shown on the wedding day)
- The amount is not in the words file. It is `SHARE_GBP` in `js/first/core.js`. No payment date is shown anywhere yet: the line says to send your share in the spring. Add a date only once you know when the balance is due to the villa.

Then run `node --test tests/*.test.cjs`. One test checks the words for the house rules (no long dashes, no dot separators, no full stop on a short line) and will name any line that breaks them.

## 6. Flip the switch

In `index.html` set `data-first-enabled="true"`. Three tests pin the exact tag (`first-switch`, `ported-features`, `storybook-scenes`) and will fail until they are updated to match: that is expected, and it is a one-line change in each.

## 7. Retire the old pages

Point `getting-here.html`, `weekend-guide.html`, `villas.html` and `gallery.html` at `index.html` as retired pages, and add them to `data/retired-routes.json`. Older retired pages that lead to `getting-here.html` or `weekend-guide.html` today need to lead to `index.html` too, or they would hop twice. The tests check every retired address leads to a real page, so do this as a small build step with the tests, not by hand.

Check afterwards: a guest who is not signed in can no longer reach any page that shows bank details.

## 8. Push again (Joe only)

Push sections 5 to 7 together. Open one real link without `&first=1` to confirm the invitation now opens by itself.

## If something goes wrong

- The invitation misbehaves after the switch is on: set `data-first-enabled="false"`, change the three tests from section 6 back to match, and push. The old front page is back for everyone. Replies already saved stay in the database. Pages retired in section 7 stay retired until that change is undone too.
- The rules misbehave: paste back the copy you kept in section 1 and publish.
- One household's answer is wrong: fix or clear it from the Invitations section of the dashboard.

## What this does not include

Food needs, the song request and the paid mark (phase 2; travel days are now part of the Getting there card), prices on the Getting there routes (January), and what is inside each sealed envelope (phase 3). The envelopes show their opening dates and stay sealed until those are built.
