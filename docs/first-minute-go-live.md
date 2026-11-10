# The invitation: going live

The new invitation is built on the `first-minute` branch and ships switched off. Nothing below has been run. Do the steps in order. Steps marked **Joe only** change the live database or the live site and must not be done by anyone else.

Before you start:

- The switch is `data-first-enabled` on the `optional-head` script in `index.html`. It is `"false"`.
- A preview never needs the switch: add `&first=1` to a personal link. `&first=0` forces the old site.
- `?signin=1` always shows the old sign-in, switch or no switch. The dashboard is unchanged apart from the new Invitations section in the Site tab.

## 1. Publish the database rules (Joe only)

The branch adds one block, `household`, to `firebase.rules.json`. Nothing else in the file changes compared with the published site's copy.

1. Firebase console, Realtime Database, Rules tab. Copy what is live now into a file you keep (your way back).
2. Compare the live rules with `firebase.rules.json` on `main`. If they differ, stop and work out why before going on: pasting the branch's file would overwrite the difference.
3. Paste the branch's `firebase.rules.json` and publish.

What the new block allows: anyone holding a personal link can read and write that one household's reply and stay choice. Nobody can list households. Replies close at the end of Sunday 28 February 2027. A stay choice needs a yes first.

Not yet proven: these rules have only been checked for shape by the tests. Step 3 is the real proof that they accept a reply. To see a refusal, try the Rules Playground on the same tab with a write to `household/<any made-up key>/reply`: it should be denied because no invitation has that key.

## 2. Make and import the invitation list (Joe only)

The tool is `tools/faces_welcome.py` in `C:\Users\joe-o\Github\tuscany-welcome-video`. Its steps are in that repo's `docs/LAUNCH.md` (the sections on publishing the rules and importing `/welcome`).

- Each household needs `display`, `lines` and `people` under `welcome/<key>`. `people` is what the reply screen lists, in order. Eight people at most per household.
- Import at the `welcome` node only, never at the database root.
- The private list of links stays out of this repo.

If `welcome` is already imported and current, there is nothing to do here.

## 3. Try one real link on two phones

1. Take one real personal link and add `&first=1`.
2. Open it on Joe's phone and Sophie's phone. Sound on. Watch the whole minute once, then use skip on a second link or after clearing the reply.
3. Reply yes, pick who is coming, choose a place to stay, open each card.
4. In the dashboard, Site tab, Invitations: the household should show as opened, replied, with the stay choice.
5. Clear the test reply from the same row when you are done.

This is the first time it will have been seen or heard on a real phone. Things to look for: nothing cut off, nothing that scrolls, the music starts after the first tap and the sound button works, the video plays, the countdown is right.

Optional before this, on a computer: `python scripts/check-first-fit.py` runs every screen on three phone sizes and stops with an error if anything is cut off.

## 4. Write the words

Every guest-facing line is in `js/first/words.js` and every one is a placeholder. Replace them with your own. Ones that need a decision, not just wording:

- The gifts answer (it says details will follow)
- The line under "your own place"
- The weekend lines for each day
- "Nearly ready" (shown when an envelope's date has passed but nothing is inside yet) and "Today" (shown on the wedding day)
- The amount is not in the words file. It is `SHARE_GBP` in `js/first/core.js`. No payment date is shown anywhere yet: the line says to send your share in the spring. Add a date only once you know when the balance is due to the villa.

Then run `node --test tests/*.test.cjs`. One test checks the words for the house rules (no long dashes, no dot separators, no full stop on a short line) and will name any line that breaks them.

## 5. Flip the switch

In `index.html` set `data-first-enabled="true"`. Three tests pin the exact tag (`first-switch`, `ported-features`, `storybook-scenes`) and will fail until they are updated to match: that is expected, and it is a one-line change in each.

## 6. Retire the old pages

Point `getting-here.html`, `weekend-guide.html`, `villas.html` and `gallery.html` at `index.html` as retired pages, and add them to `data/retired-routes.json`. Older retired pages that lead to `getting-here.html` or `weekend-guide.html` today need to lead to `index.html` too, or they would hop twice. The tests check every retired address leads to a real page, so do this as a small build step with the tests, not by hand.

Check afterwards: a guest who is not signed in can no longer reach any page that shows bank details.

## 7. Push (Joe only)

Merge `first-minute` into `main` and push. GitHub Pages publishes within a few minutes. Open one real link without `&first=1` to confirm.

## If something goes wrong

- The invitation misbehaves: set `data-first-enabled="false"` and push. The old site is back for everyone. Replies already saved stay in the database.
- The rules misbehave: paste back the copy you kept in step 1 and publish.
- One household's answer is wrong: fix or clear it from the Invitations section of the dashboard.

## What this does not include

Food needs, travel days, the song request and the paid mark (phase 2), and what is inside each sealed envelope (phase 3). The envelopes show their opening dates and stay sealed until those are built.
