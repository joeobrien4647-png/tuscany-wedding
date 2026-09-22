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
      guest cannot read the guest table

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
- [ ] Accuracy pass on all of them against today's facts: 5 airports + drive times, Santarsa /
      Vallorsaia, Fri 28 – Mon 31 May 2027, adults-only wording, no "book your room".
- [ ] Put the £150 / everything-included / no-gifts lines on accommodation.html and faq.html.
- [ ] Extend the reveal switch to per-section flags (travel+stay first; the rest later).
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
