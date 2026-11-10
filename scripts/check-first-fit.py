"""Phone-fit check for the guest invitation layer (index.html with ?first=1).

Serves this repository on a free local port, writes its own fixtures (invented names and invented tokens) under
.local-test/, and drives the real page in local-test mode on three phones: iPhone 13 (WebKit), Pixel 7 (Chromium)
and 375 x 600 (WebKit), plus 375 x 600 in Chromium. At every stop it records document overflow, the open card's
overflow, text that is cut off, and console errors. Exits 0 only when every stop is clean.

    PYTHONIOENCODING=utf-8 python scripts/check-first-fit.py [--shots DIR] [--device NAME]

The real database is never contacted: only local-test mode is used and any request to it fails the run.
Needs Python Playwright with Chromium and WebKit installed. Fixtures it creates are removed when it ends.
"""
import argparse, asyncio, atexit, functools, http.server, json, os, re, shutil, socket, sys, threading
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIXTURES = os.path.join(ROOT, '.local-test')
REAL_DATABASE = re.compile(r'firebasedatabase\.app', re.I)
FONT_HOSTS = re.compile(r'fonts\.(googleapis|gstatic)\.com')

# The clock is fixed so the check gives the same answer on any day (the page reads ?fnow= in local-test mode).
NOW = 1794744000000                 # Sun 15 Nov 2026, 12:00 UTC
REPLIES_CLOSE_MS = 1803859200000    # Mon 1 Mar 2027, 00:00 UTC (the end of Sun 28 Feb)
AFTER_CLOSE = REPLIES_CLOSE_MS + 86400000
ESTATE_DUE = 1801558800000          # Tue 2 Feb 2027, 09:00 UK, after the estate envelope's date
WEDDING_DAY = 1811545200000 + 3600000   # Sat 29 May 2027, 01:00 UK
DAY_AFTER = 1811545200000 + 2 * 86400000

# Words the checks look for (they live in js/first/words.js and are placeholders there).
TRY_AGAIN = 'Try again'

# Invented guests with invented tokens. Nothing here belongs to a real invitation.
INVITES = [
    {'key': 'Alex', 'token': 'fitcheck-alex-one-0001', 'display': 'Alex', 'lines': ['Alex'], 'people': ['Alex']},
    {'key': 'Alex & Sam', 'token': 'fitcheck-alex-sam-0002', 'display': 'Alex & Sam', 'lines': ['Alex & Sam'], 'people': ['Alex', 'Sam']},
    {'key': 'Alexandra-Marie & Christopher O\'Néill', 'token': 'fitcheck-long-pair-0003',
     'display': 'Alexandra-Marie & Christopher O\'Néill', 'lines': ['Alexandra-Marie & Christopher O\'Néill'],
     'people': ['Alexandra-Marie', 'Christopher O\'Néill']},
]
# A pair used only by the save-failure and busy-guard checks.
SPARE = {'key': 'Spare pair', 'token': 'fitcheck-spare-pair-0004', 'display': 'Jo & Kit', 'lines': ['Jo & Kit'], 'people': ['Jo', 'Kit']}

DEVICES = [
    {'name': 'iPhone 13', 'engine': 'webkit', 'preset': 'iPhone 13'},
    {'name': 'Pixel 7', 'engine': 'chromium', 'preset': 'Pixel 7'},
    {'name': '375x600 WebKit', 'engine': 'webkit', 'viewport': {'width': 375, 'height': 600}},
    {'name': '375x600 Chromium', 'engine': 'chromium', 'viewport': {'width': 375, 'height': 600}},
]

CHECK_JS = r"""() => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement, first = document.getElementById('first');
  const out = { doc: Math.max(de.scrollWidth - vw, 0) + Math.max(de.scrollHeight - vh, 0), card: 0, cut: [] };
  const card = first && first.querySelector('.fc-card');
  if (card) out.card = Math.max(card.scrollWidth - card.clientWidth - 1, 0) + Math.max(card.scrollHeight - card.clientHeight - 1, 0);
  if (!first) return out;
  const seen = new Set(), say = (key, msg) => { if (!seen.has(key)) { seen.add(key); out.cut.push(msg); } };
  const hidden = el => { for (let a = el; a && a !== document.body; a = a.parentElement) {
    const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return true; } return false; };
  const clips = el => { const s = getComputedStyle(el); return s.overflowX !== 'visible' || s.overflowY !== 'visible'; };
  const over = el => el.clientWidth > 0 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  const label = el => el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(' ')[0];
  const walker = document.createTreeWalker(first, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.trim(), el = n.parentElement;
    if (!text || !el || !el.getClientRects().length || hidden(el)) continue;
    const short = '"' + text.slice(0, 32) + '"';
    // A line box tighter than the font (the big numerals, the display headings) always reports a little vertical
    // overflow in Chromium although every glyph is drawn, so for an open box only sideways spill counts here;
    // the screen and clipping-box checks below catch a glyph that is really cut.
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) say(el, 'text spills sideways from ' + label(el) + ' ' + short);
    for (let a = el; a && a !== first.parentElement; a = a.parentElement) if (clips(a) && over(a)) say(a, 'clipping box overflows ' + label(a) + ' ' + short);
    const range = document.createRange(); range.selectNodeContents(n);
    let clip = null;
    if (!el.closest('svg')) for (let a = el; a && a !== first; a = a.parentElement) if (clips(a)) { clip = a; break; }
    const box = clip && clip.getBoundingClientRect();
    for (const r of range.getClientRects()) {
      if (!r.width) continue;
      if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5)
        say(short + 'out', 'outside the screen ' + short + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
      if (box && (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5))
        say(short + 'box', 'cut by its box ' + label(clip) + ' ' + short);
    }
  }
  return out;
}"""
INK_JS = r"""() => { const c = document.querySelector('#first .fm-fx'); if (!c || !c.width) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 64) if (d[i] > 0) n++; return n; }"""
DOCK_JS = "() => Array.from(document.querySelectorAll('#first .fh-dk')).map(b => [b.className.replace('fh-dk ', ''), b.textContent])"
OPT_JS = "() => Array.from(document.querySelectorAll('#first .fc-opt.fc-on .fc-opt-title')).map(e => e.textContent)"


# ---------- the server and the fixtures ----------
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def start_server():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


class Fixtures:
    """Writes only files under its own tokens, and removes exactly those at the end."""

    def __init__(self):
        self.files, self.dirs, self.made_root = [], [], not os.path.isdir(FIXTURES)
        atexit.register(self.remove)

    def _write(self, path, data):
        folder = os.path.dirname(path)
        missing = []
        while not os.path.isdir(folder):
            missing.append(folder)
            folder = os.path.dirname(folder)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.dirs += [d for d in reversed(missing) if d not in self.dirs]
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        if path not in self.files:
            self.files.append(path)

    def invite(self, guest):
        for field in ('display', 'lines', 'people'):
            self._write(os.path.join(FIXTURES, 'welcome', guest['token'], field + '.json'), guest[field])
        self.household(guest['token'], None)

    def household(self, token, record):
        self._write(os.path.join(FIXTURES, 'household', token + '.json'), record)

    def remove(self):
        for path in self.files:
            try:
                os.remove(path)
            except OSError:
                pass
        for folder in sorted(self.dirs, key=len, reverse=True):
            try:
                os.rmdir(folder)
            except OSError:
                pass
        self.files, self.dirs = [], []


def replied(guest, stay=None):
    record = {'reply': {'answer': 'yes', 'coming': [True] * len(guest['people']), 'at': 1790000000000}}
    if stay:
        record['stay'] = {'choice': stay, 'at': 1790000000001}
    return record


# ---------- one flow in one fresh browser context ----------
class Flow:
    def __init__(self, browser, device, label, base, shots, results):
        self.browser, self.device, self.label, self.base, self.shots, self.results = browser, device, label, base, shots, results
        self.errors, self.seen_errors, self.database_hits, self.fails, self.count = [], 0, [], [], 0

    async def open(self, options):
        self.context = await self.browser.new_context(**options)
        await self.context.route(REAL_DATABASE, self.refuse_database)
        self.page = await self.context.new_page()
        self.page.on('console', self.on_console)
        self.page.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e).splitlines()[0]))
        self.page.on('response', self.on_response)
        return self.page

    async def refuse_database(self, route):
        self.database_hits.append(route.request.url)
        self.fails.append('asked the real database: ' + route.request.url)
        await route.abort()

    def on_console(self, message):
        if message.type != 'error':
            return
        where = (message.location or {}).get('url', '')
        if FONT_HOSTS.search(where) or FONT_HOSTS.search(message.text):
            return
        if 'Failed to load resource' in message.text and REAL_DATABASE.search(where):
            return
        self.errors.append('console: ' + message.text.splitlines()[0] + ' ' + where)

    def on_response(self, response):
        if response.status >= 400 and not FONT_HOSTS.search(response.url):
            self.errors.append('http %s %s' % (response.status, response.url))

    def url(self, token=None, now=NOW):
        return '%s?first=1&wtest=1%s&fnow=%d' % (self.base, '&w=' + token if token else '', now)

    def expect(self, condition, message):
        if not condition:
            self.fails.append(message)

    async def stop(self, name):
        await self.page.wait_for_timeout(250)
        found = await self.page.evaluate(CHECK_JS)
        new_errors = self.errors[self.seen_errors:]
        self.seen_errors = len(self.errors)
        self.count += 1
        if self.shots:
            file = re.sub(r'[^A-Za-z0-9]+', '-', '%s %s %s' % (self.device['name'], self.label, name)).strip('-') + '.png'
            await self.page.screenshot(path=os.path.join(self.shots, file))
        row = {'device': self.device['name'], 'flow': self.label, 'stop': name, 'doc': found['doc'], 'card': found['card'],
               'cut': found['cut'], 'errors': new_errors}
        self.results.append(row)
        return row

    async def close(self):
        await self.context.close()


async def watch_minute(p):
    await p.wait_for_selector('#first .fm-seal', state='visible')
    await p.wait_for_timeout(2600)
    await p.click('#first .fm-seal')
    await p.wait_for_timeout(1400)
    await p.click('#first .fm-skip')


async def see_ask(p):
    await p.wait_for_selector('#first .fr-ask', state='visible')
    await p.wait_for_timeout(900)


async def see_home(p, wait=1600):
    await p.wait_for_selector('#first .fh-trip', state='visible', timeout=8000)
    await p.wait_for_timeout(wait)


async def open_dock(f, nth):
    p = f.page
    await p.click('#first .fh-dk >> nth=%d' % nth)
    await p.wait_for_selector('#first .fc-card', state='visible')
    await p.wait_for_timeout(1200)
    f.expect(await p.locator('#first .fc').count() == 1, 'not exactly one card')


async def close_card(f):
    await f.page.keyboard.press('Escape')
    await f.page.wait_for_timeout(250)
    f.expect(await f.page.locator('#first .fc').count() == 0, 'Escape did not close the card')


async def pick_stay(f, nth):
    await f.page.click('#first .fc-opt-head >> nth=%d' % nth)
    await f.page.wait_for_timeout(700)


async def with_seen_home(f, guest, record, now=NOW):
    f.fixtures.household(guest['token'], record)
    await f.page.add_init_script("localStorage.setItem('sj-first-seen', '1')")
    await f.page.goto(f.url(guest['token'], now))
    await see_home(f.page)


# ---------- the flows ----------
async def flow_first_visit(f, guest):
    """Cover, skip, ask, (who is coming), yes, home."""
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token']))
    await f.stop('cover')
    await watch_minute(p)
    await see_ask(p)
    await f.stop('ask')
    if len(guest['people']) > 1:
        await p.click('#first .fr-row .fr-ghost >> nth=0')
        await p.wait_for_selector('#first .fr-person', state='visible')
        await f.stop('who-is-coming')
        await p.click('#first .fr-person >> nth=1')
    else:
        await p.click('#first .fr-gold')
    await p.wait_for_selector('#first .fr-yes', state='visible')
    await p.wait_for_timeout(900)
    f.expect(await p.evaluate(INK_JS) > 0, 'no fireworks after yes')
    await f.stop('yes')
    await see_home(p)
    await f.stop('home')


async def flow_cards(f, guest):
    """Home, then each of the six cards, and each Stay option."""
    p = f.page
    await with_seen_home(f, guest, replied(guest))
    await f.stop('home-replied')
    await open_dock(f, 0)
    await f.stop('card-reply')
    await close_card(f)
    await open_dock(f, 1)
    for nth, name in ((0, 'stay-villa'), (1, 'stay-own'), (2, 'stay-later')):
        await pick_stay(f, nth)
        await f.stop('card-' + name)
    await pick_stay(f, 0)
    await p.click('#first .fc-go')
    await p.wait_for_selector('#first .fc', state='detached')
    await p.wait_for_timeout(500)
    await f.stop('home-after-stay')
    for nth, name in ((2, 'travel'), (3, 'wear'), (4, 'weekend')):
        await open_dock(f, nth)
        await f.stop('card-' + name)
        await close_card(f)
    await p.click('#first .fh-link >> text=Questions')
    await p.wait_for_selector('#first .fc-questions', state='visible')
    await p.wait_for_timeout(1200)
    await f.stop('card-questions')
    for i in range(await p.locator('#first .fc-q-head').count()):
        await p.click('#first .fc-q-head >> nth=%d' % i)
        await p.wait_for_timeout(700)
        await f.stop('card-questions-%d' % (i + 1))
    await close_card(f)


async def flow_cant_come(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token']))
    await watch_minute(p)
    await see_ask(p)
    await p.click('#first .fr-row .fr-ghost >> nth=-1')
    await p.wait_for_selector('#first .fr-center', state='visible')
    f.expect(await p.evaluate(INK_JS) == 0, 'fireworks after a no')
    await f.stop('cant-come')
    await p.click('#first .fr-center .fr-link')
    await see_ask(p)
    await f.stop('change-answer')


async def flow_closed(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token'], AFTER_CLOSE))
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('closed')
    await p.goto(f.url(None, AFTER_CLOSE))
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('closed-return')


async def flow_closed_replied(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], replied(guest, 'villa'))
    await p.goto(f.url(guest['token'], AFTER_CLOSE))
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('closed-already-replied')
    await see_home(p)
    await open_dock(f, 0)
    await f.stop('closed-card-reply')
    await close_card(f)
    await open_dock(f, 1)
    await f.stop('closed-card-stay-fixed')


async def flow_second_visit(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], replied(guest))
    await p.goto(f.url(guest['token']))
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('already-replied')
    await see_home(p)
    await p.goto(f.url(None))
    await see_home(p)
    f.expect(not await p.is_visible('#first .fm-cover'), 'the minute replayed on a second visit')
    await f.stop('second-visit-home')
    f.fixtures.household(guest['token'], None)
    await p.evaluate("() => { sessionStorage.clear(); localStorage.setItem('sj-invite-kept', %s); }" % json.dumps(guest['token']))
    await p.goto(f.url(None))
    await see_ask(p)
    f.expect(await p.is_visible('#first .fr-watch'), 'no watch-again link on a second visit')
    await f.stop('second-visit-ask')


async def flow_no_link(f, guest):
    p = f.page
    await p.goto(f.url(None))
    await f.stop('cover')
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-nolink', state='visible')
    await f.stop('no-link')
    await p.goto(f.url(None))
    await p.wait_for_selector('#first .fr-nolink', state='visible')
    await f.stop('no-link-return')


async def flow_wedding_day(f, guest):
    p = f.page
    await with_seen_home(f, guest, replied(guest, 'villa'), WEDDING_DAY)
    f.expect(await p.is_visible('#first .fh-today'), 'no "today" line on the wedding day')
    await f.stop('wedding-day')
    await p.goto(f.url(guest['token'], DAY_AFTER))
    await see_home(p)
    await f.stop('day-after')


async def flow_sealed_envelope(f, guest):
    p = f.page
    await with_seen_home(f, guest, replied(guest, 'villa'))
    await p.click('#first .fh-env >> nth=0')
    await p.wait_for_timeout(400)
    f.expect(await p.is_visible('#first .fh-toast'), 'no toast on a sealed envelope')
    await f.stop('sealed-before-date')
    await p.goto(f.url(guest['token'], ESTATE_DUE))
    await see_home(p)
    await p.click('#first .fh-env >> nth=0')
    await p.wait_for_timeout(400)
    f.expect(await p.is_visible('#first .fh-toast'), 'no toast on an envelope tapped after its date')
    f.expect(await p.locator('#first .fh').count() == 1, 'left home on a sealed tap')
    await f.stop('sealed-after-date')


SLOW_FALSE = "() => { window.__writes = 0; sjFirst.store.%s = () => { window.__writes++; return new Promise(r => setTimeout(() => r(%s), 2500)); }; }"


async def flow_reply_save(f, guest):
    """A failed reply save tells the guest and keeps the choice; a double tap sends one write; retry works."""
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token']))
    await watch_minute(p)
    await see_ask(p)
    await p.evaluate("() => { window.__real = sjFirst.store.saveReply; }")
    await p.evaluate(SLOW_FALSE % ('saveReply', 'false'))
    await p.click('#first .fr-gold')
    await p.evaluate("() => { document.querySelector('#first .fr-gold').click(); document.querySelector('#first .fr-gold').click(); }")
    await p.wait_for_timeout(150)
    f.expect(await p.is_visible('#first .fr-saving'), 'no saving line while the reply saves')
    await f.stop('reply-saving')
    await p.wait_for_selector('#first .fr-err', state='visible')
    await p.wait_for_timeout(700)
    f.expect(await p.evaluate('() => window.__writes') == 1, 'a double tap sent more than one reply write')
    f.expect(not await p.is_visible('#first .fr-yes'), 'moved on to yes after a failed save')
    f.expect(await p.evaluate(INK_JS) <= 0, 'fireworks after a failed save')
    f.expect(await p.evaluate("() => sjFirst.store.load(%s)" % json.dumps(guest['token'])) is None, 'a reply was recorded after a failed save')
    await f.stop('reply-save-failed')
    await p.evaluate("() => { sjFirst.store.saveReply = window.__real; }")
    await p.click('#first .fr-panel .fr-link >> text=' + TRY_AGAIN)
    await p.wait_for_selector('#first .fr-yes', state='visible')
    record = await p.evaluate("() => sjFirst.store.load(%s)" % json.dumps(guest['token']))
    f.expect(bool(record) and record['reply']['answer'] == 'yes', 'retry did not save the reply: %s' % record)
    await f.stop('reply-save-retried')


async def flow_stay_save(f, guest):
    """A failed stay save tells the guest and changes nothing; a double tap sends one write; retry works."""
    p = f.page
    await with_seen_home(f, guest, replied(guest))
    await open_dock(f, 1)
    await p.evaluate("() => { window.__real = sjFirst.store.saveStay; }")
    await p.evaluate(SLOW_FALSE % ('saveStay', 'false'))
    await p.click('#first .fc-go')
    await p.evaluate("() => { document.querySelector('#first .fc-go').click(); document.querySelector('#first .fc-go').click(); }")
    await p.wait_for_timeout(150)
    f.expect(await p.is_visible('#first .fc-saving'), 'no saving line while the stay saves')
    await f.stop('stay-saving')
    await p.wait_for_selector('#first .fc-note[role=alert]', state='visible')
    await p.wait_for_timeout(500)
    f.expect(await p.evaluate('() => window.__writes') == 1, 'a double tap sent more than one stay write')
    f.expect(await p.evaluate(OPT_JS) != [], 'the pick was lost after a failed save')
    dock = await p.evaluate(DOCK_JS)
    f.expect(dock[1][0] == 'fh-glow', 'the Stay dock item changed after a failed save: %s' % dock[1])
    await f.stop('stay-save-failed')
    await p.evaluate("() => { sjFirst.store.saveStay = window.__real; }")
    await p.click('#first .fc-go')
    await p.wait_for_selector('#first .fc', state='detached')
    await p.wait_for_timeout(400)
    dock = await p.evaluate(DOCK_JS)
    f.expect(dock[1][0] == 'fh-done', 'retry did not mark Stay done: %s' % dock[1])
    await f.stop('stay-save-retried')


async def flow_busy_guard(f, guest):
    """On a save that works, a double tap still sends exactly one write (reply, then stay)."""
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token']))
    await watch_minute(p)
    await see_ask(p)
    await p.evaluate(SLOW_FALSE % ('saveReply', 'true'))
    await p.evaluate("() => { const b = document.querySelector('#first .fr-gold'); b.click(); b.click(); }")
    await p.wait_for_selector('#first .fr-yes', state='visible')
    f.expect(await p.evaluate('() => window.__writes') == 1, 'a double tap on yes sent %s reply writes' % await p.evaluate('() => window.__writes'))
    await see_home(p)
    await open_dock(f, 1)
    await p.evaluate(SLOW_FALSE % ('saveStay', 'true'))
    await p.evaluate("() => { const b = document.querySelector('#first .fc-go'); b.click(); b.click(); }")
    await p.wait_for_selector('#first .fc', state='detached')
    f.expect(await p.evaluate('() => window.__writes') == 1, 'a double tap on confirm sent %s stay writes' % await p.evaluate('() => window.__writes'))
    await f.stop('busy-guard-done')


PER_INVITE = [('first-visit', flow_first_visit), ('cards', flow_cards), ('cant-come', flow_cant_come), ('closed', flow_closed),
              ('closed-replied', flow_closed_replied), ('second-visit', flow_second_visit)]
PER_DEVICE = [('no-link', flow_no_link, None), ('wedding-day', flow_wedding_day, 1), ('sealed-envelope', flow_sealed_envelope, 1),
              ('reply-save', flow_reply_save, 'spare'), ('stay-save', flow_stay_save, 'spare'), ('busy-guard', flow_busy_guard, 'spare')]


def plan(invites, spare):
    """The table of stops: every (flow, guest) pair a device runs."""
    rows = [(guest['key'] + ' / ' + name, fn, guest) for guest in invites for name, fn in PER_INVITE]
    for name, fn, who in PER_DEVICE:
        guest = spare if who == 'spare' else invites[who] if who is not None else invites[0]
        rows.append(('everyone / ' + name, fn, guest))
    return rows


def guests_for(index):
    """Each device gets its own copy of every token, so devices running side by side never share a fixture."""
    def own(guest):
        return dict(guest, token='%s-d%d' % (guest['token'], index))
    return [own(g) for g in INVITES], own(SPARE)


async def run_device(pw, index, base, fixtures, shots):
    device, results, failures = DEVICES[index], [], []
    invites, spare = guests_for(index)
    for guest in invites + [spare]:
        fixtures.invite(guest)
    browser = await getattr(pw, device['engine']).launch()
    try:
        options = dict(pw.devices[device['preset']]) if 'preset' in device else {'viewport': device['viewport']}
        options.pop('default_browser_type', None)
        for label, fn, guest in plan(invites, spare):
            f = Flow(browser, device, label, base, shots, results)
            f.fixtures = fixtures
            await f.open(options)
            try:
                await fn(f, guest)
            except Exception as e:
                f.fails.append('exception in %s: %s' % (fn.__name__, str(e).splitlines()[0] if str(e) else repr(e)))
                try:
                    await f.stop('after-exception')
                except Exception:
                    pass
            for message in f.fails + f.errors[f.seen_errors:]:
                failures.append('%s | %s | %s' % (device['name'], label, message))
            await f.close()
    finally:
        await browser.close()
    return results, failures


def report(results, failures):
    bad = 0
    for r in results:
        problems = r['cut'] + r['errors']
        ok = not r['doc'] and not r['card'] and not problems
        bad += 0 if ok else 1
        print('%s %-16s %-52s %-26s doc=%d card=%d cut=%d errors=%d' % ('PASS' if ok else 'FAIL', r['device'], r['flow'], r['stop'],
              r['doc'], r['card'], len(r['cut']), len(r['errors'])))
        for p in problems:
            print('       ' + p)
    for message in failures:
        print('CHECK FAILED: ' + message)
    cut = sum(len(r['cut']) for r in results)
    errors = sum(len(r['errors']) for r in results)
    overflow = sum(1 for r in results if r['doc'] or r['card'])
    ok = not bad and not failures and results
    print('%s: %d stops on %d devices, %d with overflow, %d cut-off texts, %d console errors, %d failed checks' % (
        'PASS' if ok else 'FAIL', len(results), len({r['device'] for r in results}), overflow, cut, errors, len(failures)))
    return 0 if ok else 1


async def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--shots', help='save a screenshot of every stop into this folder (keep it out of git)')
    parser.add_argument('--device', help='run only the devices whose name contains this text')
    args = parser.parse_args()
    if args.shots:
        os.makedirs(args.shots, exist_ok=True)
    server, port = start_server()
    fixtures = Fixtures()
    results, failures = [], []
    try:
        wanted = [i for i, d in enumerate(DEVICES) if not args.device or args.device.lower() in d['name'].lower()]
        async with async_playwright() as pw:
            runs = await asyncio.gather(*[run_device(pw, i, 'http://127.0.0.1:%d/' % port, fixtures, args.shots) for i in wanted])
        for got, bad in runs:
            results += got
            failures += bad
    finally:
        server.shutdown()
        server.server_close()
        fixtures.remove()
    return report(results, failures)


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
