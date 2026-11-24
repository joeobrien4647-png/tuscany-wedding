# The invitation: going live

The new invitation is built on the `first-minute` branch and ships switched off. Sections 1 to 4 were done on 11 Nov 2026, and section 4a's rules and push on 14 Nov 2026; what is still to do is marked in 4a and 4b. Do the sections in order. Sections marked **Joe only** change the live database or the live site and must not be done by anyone else.

The order matters. The code goes live first with the switch off, so guests see no change, and only then is it tried for real on two phones. The switch is flipped last.

Before you start:

- The switch is `data-first-enabled` on the `optional-head` script in `index.html`. It is `"false"`.
- A preview never needs the switch: add `&first=1` to a personal link. `&first=0` forces the old site.
- `?signin=1` always shows the old sign-in, switch or no switch. The dashboard is unchanged apart from the new Invitations section in the Site tab.

## 1. Publish the database rules (Joe only)

The rules on `main` should match what is live. The song board branch adds only its own blocks to `firebase.rules.json`: `songs` and `pub` under `household`, and two top-level blocks, `songOwner` and `board` (section 4f). So in step 2 the live rules should match `main`, and the branch's file differs from both only by those blocks. Publish them before the song board code is pushed: until then every song save is refused. They are proven on the local emulator by `scripts/check-song-rules.cjs` (its header has the command).

1. Firebase console, Realtime Database, Rules tab. Copy what is live now into a file you keep (your way back).
2. Compare the live rules with `firebase.rules.json` on `main`. If they differ, stop and work out why before going on: pasting the branch's file would overwrite the difference.
3. Paste the branch's `firebase.rules.json` and publish.

What the `household` block allows: anyone holding a personal link can read and write that one household's reply and stay choice. Nobody without the link can read it, and nobody but a signed-in admin can list households. Replies close at the end of Sunday 28 February 2027. A stay choice needs a yes first.

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

Optional here, required after writing the words (section 5): on a computer with Python and Playwright installed and a network connection, `python scripts/check-first-fit.py` runs every screen on four phone setups and stops with an error if anything is cut off. It takes about fifteen minutes.

## 4a. The Getting there card

Built on the `getting-there` branch, on top of sections 1 to 4, which were done on 11 Nov 2026. The Getting there work was pushed to `main` on 14 Nov 2026 (commit 14e8514) with the switch off, and the Firebase rules with the `travel` block were published the same day. Still to do: the two-phone test on the live site, and clearing the test tickets afterwards. The card sits behind the same switch, so guests see nothing until section 6.

What it adds: a guest builds their trip on a map, fills a ticket and stamps it. A stamped ticket is saved at `travel/<their key>/<ticket number>`, where a personal link can write but never read. Only a signed-in admin can read it, so guests cannot see each other's plans. The phone that stamped a ticket keeps its own copy and shows it again; another phone starts empty.

**Publish the rules (Joe only).** Done on 14 Nov 2026. The steps are kept as a record of what was done. The branch adds one block, `travel`, to `firebase.rules.json`, beside `household`. Nothing else in the file changes.

1. Firebase console, Realtime Database, Rules tab. Copy what is live now into a file you keep (your way back).
2. Compare the live rules with `firebase.rules.json` on `main`. They should match what you published on 11 Nov. If they differ, stop and work out why first.
3. Paste the `getting-there` branch's `firebase.rules.json` and publish.
4. Check a link cannot read tickets: in the Rules Playground, a read of `/travel` and of `/travel/anything` with no sign-in should both be denied.
5. Check a household with no yes cannot stamp: in the Rules Playground, a set at `/travel/<a key with no reply>/0` with no sign-in should be denied.
6. Two more that should be denied, using a key that has replied yes: a read of `/travel/<that key>/0`, and a set at `/travel/<that key>/8` (there are only eight tickets, 0 to 7).

Not yet proven: the rules have only been checked for shape by the tests. That they accept a real stamp is proven by the two-phone test below, and by nothing before it. The rules were published on 14 November 2026.

**Push with the switch still off (Joe only).** Done on 14 Nov 2026 (commit 14e8514). Merge `getting-there` into `main` and push, as in section 3. The site should look exactly as before.

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

## 4b. The four cards pass

The Weekend screen (four day tiles, each day opening full screen), the four-button home screen and the Questions changes went to `main` on 15 November 2026 (commit 275b420), with the switch still off. The two-phone list below is still to do. The sharper day pictures and a round of small fixes followed on 16 November 2026, also with the switch off. Try them on Joe's phone and Sophie's phone, with `&first=1&test=1` on your own household's link:

1. Open Weekend and a day. Swipe between the days with a finger, both ways, on both phones.
2. Tap the marks at the foot of a day: each one jumps to its day.
3. Press the close control on an open day: it goes back to the four days. Press it again: the card closes.
4. On the home screen, the four buttons sit evenly across the row.
5. Open Questions and open every question in turn.
6. Switch on Reduce Motion (iPhone: Settings, Accessibility, Motion; Android: Settings, Accessibility, Remove animations) and do 1 to 5 again. The Weekend title, the line under it and "Tap a day for the details" must all show.
7. Turn a phone sideways on an open day and back again.
8. Look at how sharp the Saturday picture is on a real screen.
9. Open each day and wait a moment: the picture starts to move (Friday the toast, Saturday the light and falling petals, Sunday the pool, Monday the goodbye). Swipe to the next day: the last one stops and the new one starts. The words must never wait for the moving picture.
10. With Reduce Motion on, every day picture stays still. The same with Data Saver on (Android Chrome: Settings, Lite mode or Data Saver). iPhones do not tell a site about Low Data Mode, so an iPhone on Low Data Mode still gets the moving pictures.
11. Open a day and press "See the picture" under the close control: the words and the dark shade step aside, the whole picture shows, moving, and the control turns gold and reads "Back to the day". Press it again, or the close control, and the words come back. Swipe to another day while the picture is clear. The control should show its words on every day; it drops to the icon alone only when a day's words are long enough to reach up under it on a small screen.
12. On mobile data with a weak signal, open a day: the still picture shows straight away, and the moving one takes over only when it is ready. Each day is about half a megabyte to one megabyte, fetched only when that day is opened.

## 4c. Food needs and the link preview

This work is on the branch `food-and-preview`, not on `main`. It goes to `main`, with the switch still off, only when Joe says so.

What it adds:

- The food step after a yes: one person per screen, quick picks, a short note, and skip any time. The Reply card opens by itself a moment after the fireworks and offers it, and later it is the "Add food needs" or "Change food needs" button on the Reply card.
- The count line on the Reply card ("Food needs given for 1 of 2") and, after the cut-off, a read-only view of what was given.
- A read-only food list on the dashboard, with a button to copy it as text for the caterer.
- The Questions food answer, which now points at the reply.
- The link preview picture, which is in the repo and not switched on.

**Publish the rules (needs Joe's yes).** The branch adds one block, `food`, inside `household` in `firebase.rules.json`. Until it is published, a guest's Done shows the save error, so publish before the two-phone test. Claude can do it from this computer with the Firebase tool, saving a copy of the live rules first, as was done for the travel rules on 14 November 2026. To do it yourself instead:

1. Firebase console, Realtime Database, Rules tab. Copy what is live now into a file you keep.
2. Compare the live rules with `firebase.rules.json` on `main`. Once this branch is on `main`, the two differ by exactly the `food` block until the rules are published: that one difference is expected. If they differ in anything else, stop and work out why.
3. Paste the branch's file and publish.

**Check the rules after publishing.** Claude checks with real requests to the database, with no sign-in, against a test household that has said yes (Joe's own, during his two-phone test):

- a proper save of food needs is accepted, and is then removed again;
- the same save with a pick called `steak` is refused;
- a save for a household with no yes reply is refused;
- reading `/household` as a whole, with no sign-in, is refused.

Joe's fallback is the Rules Playground, with no sign-in: a set at `/household/<a key with no reply>/food` is denied, and a set at `/household/<a yes key>/food` with a pick called `steak` is denied. The Playground cannot prove that a proper save is accepted, so it does not replace the check above.

A household that has said yes may remove its own food needs before the cut-off (the rule allows it). On the dashboard, Clear removes a household's food needs along with its reply and stay choice, and asks first. Can't come does not remove them: every list ignores food needs from a household that has not said yes, and if the answer is set back to yes, that household's food needs come back. The dashboard writes as the signed-in admin, so the food rule does not limit it. The dashboard's food list has not been seen running yet, because nobody could sign in during the build. Check it once the rules are published.

"Saved for X, check with them" on the dashboard: food needs are kept by each person's place on the invitation and their name. Editing or reordering the names on an invitation un-matches that person's food needs. Either the guest gives them again, or the name goes back as it was.

To add food needs for a guest who answers by message, open their own link with `&test=1` added, so it is not recorded as that guest opening their invitation.

Two phones (`&first=1&test=1` on your own household's link):

1. Reply yes and watch the Reply card open by itself after the fireworks, offering the food step. Say if it comes too soon. Close it and see the count line on the Reply card.
2. Add food needs for each of you. Open Change on the other phone and see them.
3. Change one, press Done, and check the dashboard row and the caterer list.
4. Tap Nothing for me and see the other picks go off.
5. Try a note of 80 characters. Type a note with the keyboard up, and check the screen settles and Done can be reached.
6. Press Done in flight mode and see Try again.
7. Open the step on both phones at once, each of you fill in your own, press Done on one and then the other, and check both show on the dashboard.
8. Press Clear on the dashboard for your own household and see the food needs go.
9. Turn on Reduce Motion and do it again.

The words Joe needs to write are under `food` in `js/first/words.js` (the title, the hint, the ten picks, the note label and placeholder, the count line, the buttons and the closed line), and the Questions food answer. To trim or add picks, change `PICKS` in `js/first/food-core.js` and the rule's list in `firebase.rules.json` together (a test checks they match), then publish the rules again.

At go-live (section 6): change the `og:image` address in `index.html` to `https://sophieandjoe2027.com/images/first/share-preview.jpg`. There is no separate Twitter image tag; the Twitter card uses `og:image`. Update the one test that pins the old address, `tests/share-preview.test.cjs`. To check it: WhatsApp keeps a preview per address, so send yourself a personal link you have never sent before and look at the picture. Facebook's Sharing Debugger shows it too. To make the picture again: `PYTHONIOENCODING=utf-8 python scripts/make-share-preview.py`.

The phone-fit check now walks the food step on all four setups (one, two, three and eight people, the fullest screen, after the cut-off, a failed save, both phones in the step at once, leaving mid-step, and the cut-off passing while the step is open). The last full run took 15 minutes (881 seconds) and ended with PASS on 904 stops.

## 4d. The envelope seals and their panels

Pushed to `main` on 18 November 2026 (commit cb9309c), with the switch still off. Each of the six envelopes on the home screen has its own seal: the same red wax, with a gold emblem of what is inside (the estate a farmhouse and a cypress, Your room a key, The feast a fork and an olive sprig, Your seat a table and chairs, The premiere a reel, The snaps a camera). Each envelope also carries a small gold "i" in its top corner (added 23 November 2026). Tapping an envelope gives a little shake, then opens a panel over the dimmed home screen: its seal, its name, what is inside, when it opens, and Remind me for its own day. The snaps have no date yet, so their panel has no Remind me. All six names and lines are yours (section 5).

1. Look at the six seals on both phones: each emblem should be clear at a glance, and none blurred or blotchy. Your seat has the finest detail, a table and chairs; say if it reads as a cog rather than a table.
2. Tap each envelope: it gives a little shake, then its panel opens. The estate's reads "Check out the venue and where you'll be staying" and "Opens Mon 1 Feb", with Remind me underneath.
3. Close a panel with the close button, then another with a tap on the dimmed space around it. Each time you land back on the envelope you tapped.
4. On the Android phone, tap Remind me in the Your room panel: Google Calendar should open on Thu 1 Apr, that envelope's own day.
5. With VoiceOver (iPhone) or TalkBack (Android) on, each envelope is read as its name, when it opens, and "see what's inside"; its panel reads as a dialog.
6. The seal on the opening cover still shows S&J, as before.

To change an emblem, replace its path in `EMBLEMS` in `js/first/home.js`.

## 4e. Remind me, and the home screen

Under the countdown, the line naming the next envelope ends with "Remind me". On an iPhone or a computer it opens `tuscany-2027-dates.ics`: the weekend and the three days the envelopes open (1 Feb, 1 Apr, 1 May), each opening with a reminder at 9am. On Android, where Google Calendar cannot read such a file, it opens Google Calendar's own form for the next envelope's day instead. The events link to the plain site address, which finds the guest's invitation in the browser where they first opened their link (the invitation keeps it there after the minute); anywhere else it shows "Please use the link Joe or Sophie sent you".

1. On an iPhone, tap Remind me: the calendar should offer to add four events. Add them and check the dates and the 9am reminders.
2. On an Android phone, if you have one to hand, tap Remind me: Google Calendar opens on 1 Feb with "The estate opens". Save it.
3. Tap the link inside one of the added events: it should open your invitation.
4. Add the invitation to the home screen (iPhone: Share, Add to Home Screen) and open it from there. Say whether it opens your invitation or "Please use the link Joe or Sophie sent you". On an iPhone a home-screen web app can start with its own empty storage; if it shows that line, the icon needs more work before guests are told about it.
5. Afterwards delete the test events from your calendar.

## 4f. The song board

The fifth button in the dock, Songs, opens a board of the songs that households who said yes have asked for, most wanted first, each with how many households want it. A household can add up to three songs from Apple's catalogue, back another household's song with Me too, and remove its own, until the end of Saturday 15 May 2027 (UK time). After that the board can still be read and nothing on it changes. The board shows songs and counts only, never who asked: the dashboard's Song requests shows who. A household that changes its reply to Can't come loses its songs from the board.

Publish the new rules first (section 1): until then every song save is refused.

1. Phone A adds a song: it shows in Your songs and on the board with "1 request", and the Songs button in the dock shows done.
2. Phone B, another household that said yes, opens Songs and sees the song. Me too makes it "2 requests".
3. Tap a song's cover to play its preview: the invitation's music fades out and the preview plays. Tap it again to stop: the music comes back from where it was.
4. Dashboard, Site tab, Invitations: Song requests lists the song with both households, and Copy as text gives one line for it with its title, artist and (2).
5. Remove it there (it asks first). Open Songs again on both phones: it is gone from both boards, and a search no longer finds it.
6. Allow again, under Taken down, lets it be found again.
7. Phone A changes its reply to Can't come. Open Songs again on Phone B: Phone A's songs have left the board.
8. Apple's terms. Apple's Search API page (performance-partners.apple.com/search-api, its Legal section, read on 23 Nov 2026; its footer says 2022) treats previews and covers as promotion of the music: shown beside a store badge that links to the song, with "provided courtesy of iTunes" when previews are used, and previews streamed, never saved. The card streams previews and never saves them, and says "Song previews provided courtesy of iTunes" under the board. Every song has an Apple Music link to that song. The board ends with Apple's Listen on Apple Music badge, which opens Apple Music (you chose it on 23 Nov 2026). Apple's identity guidelines allow only one badge in a piece of communication, so the songs keep their own links rather than a badge each. The badge is Apple's own picture, unchanged: `Apple_Music_Listen_on_Badge_RGB_USGB-EN_CI_122225.png` (82,695 bytes, 1200 by 463) from the Download link in section 1.1 of Apple's Apple Music identity guidelines (marketing.services.apple/apple-music-identity-guidelines), saved as `images/first/apple-music-badge.png`. It keeps to those guidelines: 36 px tall (they ask for at least 30), clear space of at least a tenth of its height, below the songs and smaller than them, its gray border kept, no effects, and alt text that says "Listen on Apple Music". The guidelines ask for the SVG version on screens; you chose the PNG (81 KB) over the SVG (899 KB) to keep the page light. On both phones, check that the badge looks sharp and opens Apple Music.

## 5. Write the words

Every guest-facing line is in `js/first/words.js`. Joe chose every line on 23 and 24 Nov 2026, through multiple-choice questions: the changes are listed under Written, below, and every line not listed there was kept as it was. The home screen has five buttons: Reply, Stay, Travel, Weekend and Songs. There is no Wear card; what to wear is a line inside each day of the Weekend card. The Getting there card's lines are under `travel`; its airports, airlines, drive times and tolls are not words, they come from `data/getting-there.json`. Still open:

- The four day pictures (`images/first/fri.webp`, `sat.webp`, `sun.webp`, `mon.webp`) were made with an image tool from real photos of La Conca, so they are true to the place, and each shows the feel of its day. They are not a promise of the exact set-up on the day. Swap any picture that shows something La Conca will not have.
- The amount is not in the words file. It is `SHARE_GBP` in `js/first/core.js`. No payment date is shown anywhere yet: the line says to send your share in the spring. Add a date only once you know when the balance is due to the villa.

Written (23 and 24 Nov 2026):

- All six envelope lines (`what` under `home.envelopes`). The premiere's line is about your weekend trailer.
- The envelope panel's "see what's inside" (`seeInside`) and "Opens in June" (`photosOpens`), kept as they were. The photos stay in June (`photosStamp`) until their date is known.
- The home screen: "Ciao" above the names (`kicker`, also the heading when a link has no name), "days till Tuscany" by the countdown, "Still in the post" for an envelope whose date has passed with nothing inside yet (`soon`), and the envelope names The estate, Your room, The feast, Your seat, The premiere and The snaps. "Today", "Remind me" and every other home label are kept as they were.
- The calendar file `tuscany-2027-dates.ics`: the weekend is "Sophie & Joe's wedding weekend", and the 1 May event names the feast, your seat and the premiere.
- The cover and the minute: "You're invited" when a link has no names, "Skip the intro", "Join us at" over La Conca and "The plan" over the four days. "Sophie & Joe", "For", "Tap the seal", "Tuscany, May 2027", "Tuscany", the dates and the labels only screen readers hear are kept as they were.
- The Reply: "Coming to Tuscany?", "Wouldn't miss it", "Not all of us can make it" (right for any household size), "Who can make it?" and "Let us know by {date}"; "Tuscany, here you come" and "You're on the list" after a yes; "We'll raise a glass to you" after a no; "On the list" and "Change it any time until {date}" on the Reply card. Every other reply line is kept as it was.
- The Weekend card: Friday is "Welcome night", with a dress theme ("Italian summer: linen, stripes and shades"); Saturday has "Dinner and dancing" in the evening; Sunday is "Recovery mode" by the pool; Monday ends with "A proper breakfast". The part-of-day tags are confirmed, the clothes row is labelled "Dress code", and the hint is "Tap a day for the details". The title, the other three day names, "Swipe for the next day", the see-the-picture control and the spoken labels are kept as they were. `tests/weekend-view.test.cjs` now pins your Dress code and Bring lines.
- The Questions card: Gifts says no gifts are expected and that contributions to your honeymoon would be incredibly appreciated; Weather and packing is "Pack for sun by day, a layer by night" with the forecast to follow. The title, the six questions and the other four answers are kept as they were.
- The Stay card: "Stay nearby, we'll feed you at all three" under your own place, La Conca's "You get" lines ("A bed at La Conca for all three nights", "Every meal, and the drinks keep flowing"), Welcome night in the own-place list, and "Locked in! Message Joe or Sophie to change it" once choices are fixed. Everything else on the card is kept as it was.
- The food step: "Locked in! Message Joe or Sophie to change them" after the cut-off. The heading, the hint, the ten picks, the note, the count line, the buttons and the rest are kept as they were.
- The Songs card: the title is "Song requests", an empty board says "Be the first to request a song", and a household with three songs sees "That's your three, remove one to swap". The rest are kept, including the credit line (`credit`) and the badge's alt text (`badge`), which stay as Apple's terms ask (4f step 8).
- The dock: the five buttons are kept, and the Stay button reads "Stay?" when it needs a pick, which fits on one line where "Choose stay" took two. The labels only screen readers hear and the error lines are kept as they were.
- The Getting there card: every line is kept as it was.
- The villa share line (`stay.share`), the line under the Weekend title (`weekend.vibe`) and the Songs no-promises line (`songs.promise`).

Notes for later changes:

- A line may have no tag at all: leave out `when` and only the words show.
- At most three parts a day. A fourth is not shown.
- Monday has no Wear line, by choice.
- Five lines are not shown anywhere at the moment, so they were not part of the choosing: `home.allOpen`, `home.open`, `home.back`, `cover.forBack` and `stay.sorted`.

Then run `node --test tests/*.test.cjs`. One test checks the words for the house rules (no long dashes, no dot separators, no full stop on a short line) and will name any line that breaks them.

Then run the fit check, `python scripts/check-first-fit.py`. This step is required, not optional: nothing in the node tests limits how long a Weekend line is, and only the fit check shows a day that no longer fits a phone. It takes about fifteen minutes and should end with PASS on 916 stops.

Some tests pin your lines on purpose, so changing one fails a test that names it. When you change a pinned line, update its expected value there too:

- `tests/first-words.test.cjs`: the four day names and dates, `weekend.open` ("Open the day"), the dock labels and the Stay button's states, the photos envelope's "June", no digit anywhere in Questions, "usually" and "check before you book" in the Travel route lines, and `food.picks.none` ("Nothing for me").
- `tests/first-home.test.cjs`: "see what's inside", "Opens in June" and the dock labels with "Stay?".
- `tests/food-card.test.cjs`: the count-line words ("Food needs given for", "No food needs given yet").
- `tests/first-fixwave-c.test.cjs` (H13): `weekend.swipe` ("Swipe for the next day").
- `tests/first-cards-info.test.cjs`: "ask Joe or Sophie directly" in the bring answer, "Message Joe or Sophie" in the reach answer, "reply" (and not "message") in the food answer, "honeymoon" in the gifts answer, and the share showing as "£150 each" in the cost answer.
- `tests/first-cards.test.cjs`: "Joe or Sophie" in the Reply card's closed line.
- `tests/songs-card.test.cjs`: the no-promises line (`songs.promise`).
- `tests/weekend-view.test.cjs`: the Dress code and Bring lines.
- `scripts/check-first-fit.py`: "Still in the post" on an envelope past its date.

## 6. Flip the switch

In `index.html` set `data-first-enabled="true"`. Three tests pin the exact tag (`first-switch`, `ported-features`, `storybook-scenes`) and will fail until they are updated to match: that is expected, and it is a one-line change in each.

Once the food and preview branch is on `main`, in the same change: set the `og:image` address in `index.html` to `https://sophieandjoe2027.com/images/first/share-preview.jpg` and update `tests/share-preview.test.cjs`, which pins the old address. Section 4c says how to check the preview.

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

The paid mark (phase 2; travel days are now part of the Getting there card), prices on the Getting there routes (January), and what is inside each sealed envelope (phase 3). The envelopes show their opening dates and stay sealed until those are built.
