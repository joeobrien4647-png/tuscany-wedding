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

## Phase 4: RSVP extension (24 Sep 2026, commits ce7a897, ee0dd73, 4821cc4; pushed 24 Sep)

Decisions (Joe, relayed 24 Sep): RSVP deadline **28 February 2027**; guests leave **Mon 31 May** (default, other days allowed).

- [x] Travel on register + edit: flying from (UK list + Boston + other), flying into (PEG, FLR, BLQ, PSA, FCO, CIA, not flying, other), arriving Thu 27 / Fri 28 / Sat 29 + rough time, leaving Sun 30 / Mon 31 (default) / Tue 1 Jun + rough time, flight out / home (optional). Hidden if "can't make it". Stored at `/registrations/{uid}/travel`.
- [x] Dashboard Site tab: travel line per guest, "Flights given" count, travel columns in the CSV.
- [x] Rules: `travel/$field` must be a string of 60 chars or fewer. Optional hardening; the feature works without it.
- [ ] Joe: paste the whole of `firebase.rules.json` into Firebase console > Realtime Database > Rules > Publish.
- [x] Deadline 28 February 2027 on index, faq, contact, save-the-date (button now goes to the register page) and the old rsvp.html (was 1 March).
- [x] Reminders: dashboard "Who needs a nudge". Invited/Confirmed guests not registered, unsure registrations, yes-but-unpaid. Each person gets a Gmail compose link (Joe's note + site link); nothing sends until Joe presses Send. Copy-for-Bcc per group. Pending/Declined excluded.
- [x] Joe: OK to push. Pushed 24 Sep (a3c1f99..911f9b8); live site confirmed serving the travel fields, deadline and nudge list.
- [ ] E2E test (after push). Claude can't create accounts, type passwords or delete data, so:
  1. Joe, in the Browser pane: register on sophieandjoe2027.com as "Test Guest" (e.g. joe.obrien4647+rsvptest@gmail.com), say Yes, fill some travel.
  2. Claude, in that tab: own registration readable; `wedding-guests-v4`, `registrations` (all) and `payments` (others) denied; edit travel via the form.
  3. Joe signs into the dashboard in the pane; Claude checks the Site tab row, travel line, CSV and nudge list.
  4. Joe cleans up: Firebase console > Authentication > delete the test user; Realtime Database > delete `registrations/<uid>` (and `public/profiles/<uid>` if made).
- Later: arrivals.html reads the admin-only guest table, so guests will get nothing under the rules. Rebuild it on registration travel data before the Travel section opens.

### Review (24 Sep 2026)
Verified locally (one browser pass): register form builds both travel blocks, Mon 31 defaults, "Somewhere else" reveals the text box, travel hides on "can't", preview shows "Manchester (MAN) to Pisa (PSA). Arriving Fri 28 May, afternoon. Leaving Mon 31 May." Dashboard compiles; SiteTab rendered with mock data shows travel lines, 1 / 2 flights given, CSV travel columns, nudge list with Pending excluded and no-email flagged, correct Gmail links. No console errors, no em dashes added.
Research (cost/terms): Trigger Email needs Blaze + Firestore + SMTP; GitHub Actions scheduled jobs switch off after 60 idle days, need an admin service key in a public repo, and sit in a grey area of GitHub's terms; Gmail API compose scope is restricted. Gmail compose links: free, 500 recipients/day limit, Joe approves each send.

## Phase 5: flight guide and search links (24 Sep 2026, commits b7080d5, e498807; NOT pushed)

Joe's choice: links now, price tracker later. Travel section stays hidden; Joe flips `travel` himself.

- [x] travel.html "Where to Fly To": 8 airports ranked by drive time, UK routes per airport, "not on sale yet" marked.
- [x] "Before You Book" box: passport (issued on/after 29 May 2017 for a Fri 28 landing, 28 May 2017 for Thu 27; valid to 1 Sep 2027), ETIAS not live, EES queues, GHIC + insurance (US: own cover), car hire ZTL + US IDP.
- [x] "Search Flights" picker: same departure list and codes as the RSVP `travel.home` field. Each route gives Google Flights + Skyscanner, out Thu 27 or Fri 28, back Mon 31 (Joe, relayed 24 Sep). Routes with no Mon 31 flight back are left out (BA LHR-PEG, easyJet BRS-PSA, easyJet LGW-RMI, BA EDI-FLR). No direct route (EXT, LBA) or "Somewhere else" shows Google searches with changes.
- [x] arrivals.html drive times aligned; RMI and AOI added.
- [ ] Joe: RSVP "flying into" list lacks Rimini (RMI) and Ancona (AOI); add them (RSVP session told).
- [ ] Joe: old FAQ says "your bed is yours from Friday to Monday" but the page offers Thu 27 flights. Is Thursday night at the villa OK?
- [ ] Joe: "Travel Buddies" card still says send flights to Sophie or Joe; the RSVP now collects them. Reword when the arrivals board is rebuilt.
- [ ] Re-check Nov 2026 to Jan 2027 as Ryanair loads summer 2027 (RMI from STN/MAN; BLQ from LTN/MAN/EDI; PSA from MAN/EDI/BHX/PIK; CIA from EMA/LPL), then update ROUTES in travel.html. Also Jet2 (site down 24 Sep, nothing verified).

Sources and method (24 Sep 2026):
- Ryanair: its own timetable and fare APIs (ryanair.com/api/timtbl, farfnd). **Stansted routes to PEG, AOI, BLQ, PSA, CIA and MAN/EDI to CIA are ALREADY on sale for 27/28/31 May**, contrary to the 23 Sep research. Other bases not loaded past March 2027.
- easyJet: its route and lowest-fare endpoints (on sale to 26 Sep 2027). BA: fare calendar data behind britishairways.com. Vueling: price calendar. Wizz: timetable data. Boston: Google Flights shows Delta and ITA nonstop on 27 and 28 May. ITA Heathrow dates, Aer Lingus, Loganair not checked.
- Drive times: OSRM road routing from La Conca's OSM point (43.6023, 12.1286), rounded to 5 min: PEG 68, FLR 107, RMI 122, AOI 140, BLQ 141, PSA 168, CIA 185, FCO 220 min. Google Maps would not render in the hidden Browser pane, so not cross-checked there; the old page said Perugia 55 min, worth a spot-check.
- Links tested: Google Flights `?q=Flights from STN to PEG on 2027-05-28 through 2027-05-31` opens the right route and dates (STN-PEG, LCY-FLR, BOS-FCO checked). Skyscanner `/transport/flights/stn/peg/270528/270531/` resolved to "London to Perugia" then showed a bot check in the automated browser (not completed); normal browsers should be fine.
- Fares seen 24 Sep (one way, Ryanair): Thu 27 was cheaper than Fri 28 on most routes, e.g. STN-PEG 239 vs 336, STN-AOI 73 vs 345. Google Flights: STN-PEG 28 to 31 May from 561 return, "prices currently high".

### LATER (do not build yet): cached price tracker, Nov 2026 to Jan 2027

- Scheduled GitHub Action, a few times a day, fetches the cheapest direct fare per route (out 27/28, back 31) and commits `data/fares.json` ({updated, routes: [{from, to, airline, out27, out28, back31, currency}]}). travel.html reads it, shows prices next to the search buttons and "last updated"; hides prices if older than ~36h.
- No API keys in the public repo: GitHub Secrets only.
- Before choosing a provider, check its terms allow personal, non-business use (Stripe lesson). Candidates to check, none vetted: Amadeus Self-Service, Kiwi Tequila, SerpApi (Google Flights), Skyscanner (partner-only). Airline endpoints used above are undocumented; don't build on them without checking terms.
- Known constraints (from the RSVP session's research): scheduled workflows in public repos are disabled after 60 days without repo activity; scraping via Actions is a grey area in GitHub's terms. Each commit also redeploys Pages.

### Review (24 Sep 2026)
One browser pass on an ungated local copy: all 18 departure options produce the expected rows for both days, day fallback works (SEN on Thu searches Fri 28), no console errors besides the uncopied header image, no horizontal scroll at 375px (16px gutters), 3-column grid at 1280px, no em dashes.
- **24 Sep 2026: welcome video built** (repo Github/tuscany-welcome-video). Live on the site but OFF: js/intro.js on index.html has data-enabled="false". Preview: https://sophieandjoe2027.com/?intro=1. To switch on for guests, set data-enabled="true".
- [ ] Joe (and Sophie) to watch and approve the welcome video, then switch it on.
