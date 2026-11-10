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

Optional, on a computer with Python and Playwright installed and a network connection: `python scripts/check-first-fit.py` runs every screen on four phone setups and stops with an error if anything is cut off. It takes about six minutes.

## 5. Write the words

Every guest-facing line is in `js/first/words.js` and every one is a placeholder. Replace them with your own. Ones that need a decision, not just wording:

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

- The invitation misbehaves after the switch is on: set `data-first-enabled="false"` and push. The old front page is back for everyone. Replies already saved stay in the database. Pages retired in section 7 stay retired until that change is undone too.
- The rules misbehave: paste back the copy you kept in section 1 and publish.
- One household's answer is wrong: fix or clear it from the Invitations section of the dashboard.

## What this does not include

Food needs, travel days, the song request and the paid mark (phase 2), and what is inside each sealed envelope (phase 3). The envelopes show their opening dates and stay sealed until those are built.
