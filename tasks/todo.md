# Website Phase 0 — Register & confirm

Brief (Joe, 6 Sep 2026): keep most of the site hidden until nearer the time. For now the site is a
place where guests create a login, confirm they got the save-the-date, and give us their details.

## Architecture

- **One Firebase Auth.** Joe & Sophie already have (or will have) admin accounts from the dashboard
  gate. Guests get their own accounts through the same provider. Rules distinguish the two by UID.
- **Guests never read the guest table.** It holds notes, B-list markers, addresses. Guests read a
  small public node (`/public/guestNames` — names only, for the "who are you" picker) and write to
  `/registrations/{their uid}` — nothing else.
- **Reveal switch.** `/public/config/revealed: false`. Hidden pages check it and show "revealed
  closer to the time" until Joe flips it in the dashboard. No redeploy needed to reveal.
- **Registration links to a guest record** by the name picked at sign-up, so the dashboard shows
  who has and hasn't registered against the existing 49.

## Decisions (settled 6 Sep 2026)

- [x] Login type: **email + password** (same Firebase provider as the dashboard)
- [x] Data now: **minimal** — name, email, phone, intent (coming / not sure / can't)
- [x] Hidden pages: **Firebase reveal switch** at `/public/config/revealed`
- [x] Verification: **open registration** — anyone can sign up and type their name; matched to
      the guest list in the dashboard afterwards. So no `/public/guestNames` node is needed.

## Build (after decisions)

- [x] Fix countdown date (hardcoded 2027-05-24 → 2027-05-29)
- [x] `/public/config` node in Firebase (`revealed: false`)
- [x] New `index.html`: landing + sign-up/sign-in + register form (classes namespaced `p-*` to avoid the global `.hero`/`.card` rules)
- [x] Registration writes `/registrations/{uid}`; dashboard **Site** tab lists registrations, flags names not on the guest list, and holds the reveal switch
- [x] Security rules drafted in `firebase.rules.json` — `/admins/{uid}` whitelist; guests read `/public/*`, write own `/registrations/{uid}`. NOT yet applied (see Joe's steps)
- [x] Hide existing pages behind the reveal switch (`js/reveal.js`, fail-closed, admin bypass); old homepage kept as `welcome.html`
- [x] Joe: enable Email/Password provider, create admin accounts, paste rules (in that order) (rules live 22 Sep)
- [x] CNAME added; sophieandjoe2027.com serving from GitHub Pages (6 Sep 2026)
- [ ] Verify end to end: register as a test guest, confirm it appears in the dashboard, confirm a
      guest cannot read the guest table (runbook in Phase 4 below; needs Joe for sign-up and clean-up)

## Review (6 Sep 2026)

Built and verified locally: portal renders, countdown correct, sign-up error path shows a
friendly "not switched on yet" message, gated pages show the curtain with the original content
removed, dashboard still compiles (login screen renders), no horizontal scroll at 375px.

Not verifiable until Joe enables Email/Password: an actual sign-up round trip, and that a
guest cannot read the guest table once rules are applied.

Order of Joe's steps matters — populate `/admins` BEFORE applying rules, or the dashboard locks out.

## Phase 1 — guest profiles (decided 6 Sep 2026, not started; fresh session)

- [x] **Profile ("pocket")** on the register page once signed in: one line + one song (free text
      "Title – Artist"). Written to `/public/profiles/{uid}` (name, line, song) — the private
      registration stays in `/registrations`. Photos DEFERRED (needs Firebase Storage).
- [x] Dashboard Site tab: pool-party playlist list + "Copy list for Betto".
- [x] **Binder view** `binder.html`: one pocket per filled profile, sorted by name, your own
      pocket outlined, padded with empty pockets. Requires sign-in; NOT behind the reveal switch.
      Shows profile only — card art stays OFFLINE and secret until the day.
- [x] Rules updated: `/public/profiles/$uid` writable by its owner (validate: has name).
- Parked: wedding sweepstake (Joe unsure). Rejected: live painting page, kids' corner.

## Phase 2 — logistics reveal (decided 6 Sep 2026, not started; fresh session)

Pages already exist (Jan 2026 build) and are gated: travel, accommodation, things-to-do, faq,
itinerary, schedule, guest-map, plus arrivals.html (untracked, transfer-sharing board).
- [x] Accuracy pass on all of them against today's facts (done 23 Sep for travel, accommodation, things-to-do, arrivals, tools, schedule, itinerary, faq, contact): 5 airports + drive times, Santarsa /
      Vallorsaia, Fri 28 – Mon 31 May 2027, adults-only wording, no "book your room".
- [x] Put the £150 / everything-included / no-gifts lines on accommodation.html and faq.html.
- [x] Extend the reveal switch to per-section flags (built 22 Sep: travel, weekend, faq, story, fun; other pages full reveal only).
- [ ] Reveal travel + accommodation once May 2027 flights are on sale; arrivals board with them.
- [x] Address field on registration (private, in `/registrations`; shown in dashboard Site tab) — for thank-yous.
- [x] `index.html?preview=done` renders the registered state with sample data, saves disabled — for reviewing copy without an account.

## Phase 3: payments (bank transfer built 22 Sep 2026, commit f7f22b7)

- **£150 flat.** No surcharge, no transfer discount (card surcharges are banned for UK traders;
  fee exposure is ~£2.45 per card payment, tens of pounds total — absorb it).
- Shown on the registered screen only to guests whose intent is **Yes**. Paying = place confirmed.
- **Option 1, listed first: bank transfer.** Sort code + account, reference = their name. One line:
  "Free for everyone — a card payment costs us a couple of quid each time." Details visible only
  to signed-in registered guests, never on the public page.
- **Option 2: Stripe Payment Link** (Apple Pay, Google Pay, card; Klarna undecided). URL carries
  the Firebase uid as client_reference_id + prefilled email. Needed for US guests (Natales).
- **Reconciliation: manual.** Payment arrives (bank or Stripe email) → tick "paid" on the
  registration in the dashboard Site tab. Add a `paid` flag + paid count there.
- Dependencies: Firebase Email/Password enabled (still Joe's step); Stripe account (Joe — ID and
  bank details, not Claude). Collect by end Feb 2027 — RSVP deadline 28 Feb, villa balance
  €9,069 due 28 Mar.
- [ ] **schedule.html has the wrong week**: says Friday 23rd to Sunday 25th May. Wedding is Sat 29 May; weekend is Fri 28 to Mon 31. Fix in the accuracy pass before reveal.
- Note: of the 10 images in `images/`, only `villa-vallorsaia.jpg` is the venue. The rest are stock of Barcelona, Cinque Terre, Iceland, Florence, Sydney, the Colosseum and a beach resort. Do not use them as "the venue". Real venue photos now in `images/venue/` (from laconca.it; ask Chiara for originals / permission for the public site).
- **22 Sep 2026: Stripe DROPPED.** Its terms only allow non-business individuals with pre-approval and it does not support personal/peer-to-peer collection. Bank transfer is the main route; card option (if any) via a personal payment link (PayPal.me, Monzo or Revolut). Joe to choose. Natales (US) are the main reason for a card option.
- **22 Sep 2026: bank transfer BUILT.** Guests who said yes see details on index.html after sign-in; data in /members/payment, paid flags in /payments/{uid}. Dashboard Site tab has the bank form, Mark paid per row, Paid count.
- [ ] Joe: enter Chase details in dashboard Site tab and Save (Claude can't write to Firebase under the rules).
- [ ] Joe: decide card option (PayPal.me / Monzo / Revolut link, or none).
- **22 Sep 2026: share + robustness pass.** Link preview card (images/og.jpg), Facebook in-app browser hides Google sign-in with a note, add-to-calendar (tuscany-2027.ics + Google link) on the registered screen, Google sign-up requires a coming? answer, dashboard registrations CSV export.
- **22 Sep 2026: the register page IS the RSVP (Joe).** Added food and access questions to register + edit; shown in dashboard rows, count card and CSV.
- [ ] Joe to decide: show guests who else is coming (recommendation: yes-only, first name + surname, signed-in only, opt-out).
- **23 Sep 2026: accuracy pass pushed** (ec853ea, ac54098, c472796). arrivals.html moved OUT of the Travel section (full reveal only) until guests can submit flights. Old sophie-joe-wedding.ics deleted.
- Open questions for Joe (removed from pages until answered): RSVP deadline (1 Mar vs 28 Feb), event times and ceremony spot, airport transfers/shuttles, how guests share flight details, Wi-Fi name.
- Venue photos on the pages come from laconca.it: get Chiara's OK before opening sections.
- Estimated, not sourced: Arezzo 40m, Siena 1h30, Cortona ~1h, San Gimignano 2h15, 20 to 25C, GBP/EUR 1.17. Pisa 2h15 only from old arrivals page.

## Phase 4: RSVP extension (24 Sep 2026, commits ce7a897, ee0dd73, 4821cc4; NOT pushed)

Decisions (Joe, relayed 24 Sep): RSVP deadline **28 February 2027**; guests leave **Mon 31 May** (default, other days allowed).

- [x] Travel on register + edit: flying from (UK list + Boston + other), flying into (PEG, FLR, BLQ, PSA, FCO, CIA, not flying, other), arriving Thu 27 / Fri 28 / Sat 29 + rough time, leaving Sun 30 / Mon 31 (default) / Tue 1 Jun + rough time, flight out / home (optional). Hidden if "can't make it". Stored at `/registrations/{uid}/travel`.
- [x] Dashboard Site tab: travel line per guest, "Flights given" count, travel columns in the CSV.
- [x] Rules: `travel/$field` must be a string of 60 chars or fewer. Optional hardening; the feature works without it.
- [ ] Joe: paste the whole of `firebase.rules.json` into Firebase console > Realtime Database > Rules > Publish.
- [x] Deadline 28 February 2027 on index, faq, contact, save-the-date (button now goes to the register page) and the old rsvp.html (was 1 March).
- [x] Reminders: dashboard "Who needs a nudge". Invited/Confirmed guests not registered, unsure registrations, yes-but-unpaid. Each person gets a Gmail compose link (Joe's note + site link); nothing sends until Joe presses Send. Copy-for-Bcc per group. Pending/Declined excluded.
- [ ] Joe: OK to push (pushing deploys the live site).
- [ ] E2E test (after push). Claude can't create accounts, type passwords or delete data, so:
  1. Joe, in the Browser pane: register on sophieandjoe2027.com as "Test Guest" (e.g. joe.obrien4647+rsvptest@gmail.com), say Yes, fill some travel.
  2. Claude, in that tab: own registration readable; `wedding-guests-v4`, `registrations` (all) and `payments` (others) denied; edit travel via the form.
  3. Joe signs into the dashboard in the pane; Claude checks the Site tab row, travel line, CSV and nudge list.
  4. Joe cleans up: Firebase console > Authentication > delete the test user; Realtime Database > delete `registrations/<uid>` (and `public/profiles/<uid>` if made).
- Later: arrivals.html reads the admin-only guest table, so guests will get nothing under the rules. Rebuild it on registration travel data before the Travel section opens.

### Review (24 Sep 2026)
Verified locally (one browser pass): register form builds both travel blocks, Mon 31 defaults, "Somewhere else" reveals the text box, travel hides on "can't", preview shows "Manchester (MAN) to Pisa (PSA). Arriving Fri 28 May, afternoon. Leaving Mon 31 May." Dashboard compiles; SiteTab rendered with mock data shows travel lines, 1 / 2 flights given, CSV travel columns, nudge list with Pending excluded and no-email flagged, correct Gmail links. No console errors, no em dashes added.
Research (cost/terms): Trigger Email needs Blaze + Firestore + SMTP; GitHub Actions scheduled jobs switch off after 60 idle days, need an admin service key in a public repo, and sit in a grey area of GitHub's terms; Gmail API compose scope is restricted. Gmail compose links: free, 500 recipients/day limit, Joe approves each send.
