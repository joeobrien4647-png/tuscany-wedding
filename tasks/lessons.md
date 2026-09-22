# Lessons

## 6 Sep 2026 — one session did eight jobs and cost ~65M weighted tokens

What happened: guest list, rooms, budget, arrivals board, Pokémon cards, Figma, domain and the
register portal were all done in a single 743-turn session. 75% of the cost was re-reading the
conversation and long replies — not the actual builds (Figma + browser + web research < 10%).

Rules that came out of it (now in global CLAUDE.md §13):
- One job per session. Fresh session at ~120 turns.
- Replies under 150 words, answer first, no status recaps.
- `dashboard.html` is 260KB — never Read it whole; grep + sed ranges, one edit pass.
- One browser_batch per verification; no screenshots unless asked.

Also: the tracker lagged reality four times (save-the-dates, villa deposit, vendor outreach,
Julie & Ian). Confirm with Joe before acting on an apparent gap in the dashboard.

## 6 Sep 2026 — treated a vendor who "Responded" as booked
Pitched a live-painting feature; there is no live painter. Martin Cambriglia only replied to an
enquiry. "Responded" and "Contacted" in the vendor tracker mean nothing is booked — as of today
0 of 54 vendors are. Never build on a vendor unless status is Booked or Joe says so.

## 6 Sep 2026 — backslash escapes get mangled through the Bash tool
Twice now a Python heredoc run via the Bash tool turned a literal two-character `\n` / `✎`
into a real newline / real character before Python saw it, breaking a JS string in
`dashboard.html`. Rule: never rely on backslash escapes inside scripts passed through Bash.
Write the script file with the Write tool, or build strings with chr(10)/chr(92), or use
literal unicode characters. Verify against served bytes, not the console — console errors
persist across navigations in the browser tool and can be stale.

## 21 Sep 2026: em dashes
Joe: "never ever use Mdashes." Every reply and most site copy had them. Rule: none, anywhere.
Comma, full stop, colon or brackets instead. Grep files for the character after writing copy.

## 21 Sep 2026: dress code is not decided
Put "Black tie optional" / "Smart casual" on the live register page from the old January pages
and the Brain note. Neither is a decision. Same failure as the vendor one: old site content and
planning notes are drafts, not facts. Only the Decisions log and Joe count as settled.

## 21 Sep 2026: the hidden Browser pane does not paint
When the pane is hidden, requestAnimationFrame never fires, CSS animations sit at time 0 and
IntersectionObserver never triggers. So computed opacity of 0 on animated elements is an
artefact, not a bug. Do not "fix" it. Verify motion by checking the safety-net state instead
(html.p-settled after 4s), or by asking Joe to look. Never run an open-ended rAF loop in
javascript_tool while the pane is hidden: it hangs for 45s.

## 22 Sep 2026: recommended Stripe without checking its terms
Stripe is for businesses; personal collection needs pre-approval and peer-to-peer isn't supported.
Joe asked "is this allowed?" and it wasn't. Rule: before recommending any payment, financial or
account service, check its terms fit the actual use (personal vs business) first.
