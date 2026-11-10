"""Phone-fit check for the guest invitation layer (index.html with ?first=1).

Serves this repository on a free local port, writes its own fixtures (invented names and invented tokens) under
.local-test/, and drives the real page in local-test mode on three phones: iPhone 13 (WebKit), Pixel 7 (Chromium)
and 375 x 600 (WebKit), plus 375 x 600 in Chromium. At every stop it waits for the screen to settle, then records
document overflow, the open card's overflow, text that is cut off or spills into a neighbour, buttons, links, images
and svg that stick out of the screen or their clipping box, required elements that are missing or still hidden,
and console errors. Exits 0 only when every stop is clean.

    PYTHONIOENCODING=utf-8 python scripts/check-first-fit.py [--shots DIR] [--device TEXT] [--flow TEXT]

The real database is never contacted: only local-test mode is used and any request to it fails the run.
A run restricted with --device, --flow, --inject-css or --block-fonts prints PARTIAL, not PASS, because it did not check everything.
Needs Python Playwright with Chromium and WebKit installed (imported only when a run starts).
Fixtures it creates are removed when it ends; their tokens carry a random run id so two runs never share them.
"""
import argparse, asyncio, atexit, functools, http.server, json, os, re, secrets, socket, sys, threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIXTURES = os.path.join(ROOT, '.local-test')
# Both address families of the real database, over http and over websockets.
REAL_DATABASE = re.compile(r'firebasedatabase\.app|firebaseio\.com', re.I)
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

# Invented guests with obviously fake tokens; guests_for() adds a random run id and the device number.
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

# ---------- what every stop must show (all matches of each selector must be visible and measured) ----------
COVER_NAMED = ['.fm-cover-kicker', '.fm-for', '.fm-name', '.fm-seal', '.fm-hint', '.fm-foot', '.fm-skip', '.fm-sound']
COVER_NONAME = [s for s in COVER_NAMED if s != '.fm-for']
MINUTE_TITLE = ['.fm-s1 .fm-kicker', '.fm-s1 .fm-big', '.fm-s1 .fm-sub', '.fm-skip']
MINUTE_ESTATE = ['.fm-s2 .fm-kicker', '.fm-s2 .fm-big', '.fm-skip']
MINUTE_WEEKEND = ['.fm-s3 .fm-kicker', '.fm-s3 li', '.fm-skip']
ASK = ['.fr-by', '.fr-q', '.fr-gold', '.fr-row .fr-ghost']
WHO = ['.fr-q', '.fr-person']
SAVING = ['.fr-q', '.fr-saving']   # the chosen answer is dimmed on purpose while it saves
SAVE_FAILED = ['.fr-q', '.fr-err', '.fr-gold']
YES = ['.fr-title', '.fr-line']
ANSWERED = ['.fr-title', '.fr-link']
CLOSED_SCREEN = ['.fr-title', '.fr-line']
NO_LINK = ['.fr-center .fm-kicker', '.fr-title']
HOME = ['.fh-name', '.fh-count-n', '.fh-count-l', '.fh-env', '.fh-dk', '.fh-link']
HOME_AFTER_DAY = ['.fh-name', '.fh-env', '.fh-dk', '.fh-link']
HOME_WEDDING = ['.fh-name', '.fh-today', '.fh-env', '.fh-dk', '.fh-link']
CARD = ['.fc-t', '.fc-close']
CARD_REPLY = CARD + ['.fc-change', '.fc-notyou']
CARD_REPLY_CLOSED = CARD + ['.fc-notyou']
CARD_STAY = CARD + ['.fc-opt-head', '.fc-opt.fc-on .fc-opt-body', '.fc-go']
CARD_STAY_FIXED = CARD + ['.fc-opt-head']   # the confirm button is dimmed on purpose once the choice is fixed
CARD_TRAVEL = CARD + ['.fc-row']
CARD_WEAR = CARD + ['.fc-row']
CARD_WEEKEND = CARD + ['.fc-day']
CARD_QUESTIONS = CARD + ['.fc-q-head']
TOAST = ['.fh-toast', '.fh-env']

# Deliberate exceptions, named so nothing is loosened globally. Each has its reason.
OVERLAY_TEXT_OK = [
    '.fh-toast',     # the "opens on ..." note floats over the home screen on purpose
]
DRIFT_OK = [
    '.fm-stage',     # the film and photo layers behind the minute drift for up to 8 s
    '.fc-bg',        # the picture behind an open card drifts for 6 s
]
BLEED_OK = [
    '.fm-stage',     # the full-bleed film and photo layers are scaled past the screen edges so they never show a gap
    '.fm-defs',      # the 0 x 0 svg that only holds the seal's gradients and clip paths
]

# One in-page function: wait for the required elements to be visible and still, then measure the screen.
MEASURE_JS = r"""async ({ required, strictVertical, overlayOk, bleedOk, driftOk }) => {
  const first = document.getElementById('first'), de = document.documentElement, vw = innerWidth, vh = innerHeight;
  const out = { missing: [], doc: 0, card: 0, cut: [] };
  const opacity = el => { let o = 1; for (let a = el; a && a !== de; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity); return o; };
  const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const all = sel => (first ? Array.from(first.querySelectorAll(sel)) : []);
  const notReady = () => {
    const bad = [];
    for (const sel of required) {
      const els = all(sel);
      if (!els.length) bad.push(sel + ' not found');
      else if (els.some(e => !shown(e) || opacity(e) < 0.99)) bad.push(sel + ' still hidden');
    }
    return bad;
  };
  // Anything in the invitation still animating or transitioning (a card panel opening, a fade) must finish first.
  // Backdrops that drift for seconds on purpose (driftOk) hold no text or controls, so they are not waited for.
  const busy = () => document.getAnimations().filter(a => {
    const t = a.effect && a.effect.target;
    if (!t || !first.contains(t) || driftOk.some(s => t.closest(s))) return false;
    return (a.playState === 'running' || a.playState === 'pending') && a.effect.getComputedTiming().iterations !== Infinity;
  }).length;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const snapshot = () => JSON.stringify(required.map(sel => all(sel).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 10) / 10); })));
  const t0 = performance.now();
  let before = null, still = 0;
  while (performance.now() - t0 < 5000) {
    if (!notReady().length && !busy()) { const now = snapshot(); still = now === before ? still + 1 : 0; before = now; if (still >= 3) break; }
    else { before = null; still = 0; }
    await frame();
  }
  try { await document.fonts.ready; } catch (e) { /* no font loading api: the check below then fails */ }
  out.missing = notReady();
  if (!out.missing.length && still < 3) out.missing.push('screen never stopped moving (' + busy() + ' animations still running)');

  out.doc = Math.max(de.scrollWidth - vw, 0) + Math.max(de.scrollHeight - vh, 0);
  const card = first && first.querySelector('.fc-card');
  if (card) out.card = Math.max(card.scrollWidth - card.clientWidth - 1, 0) + Math.max(card.scrollHeight - card.clientHeight - 1, 0);
  if (!first) return out;
  // With a card open the home screen behind it is inert and covered, so only the card is measured.
  const scope = first.querySelector('.fc') || first;
  const seen = new Set(), say = (key, msg) => { if (!seen.has(key)) { seen.add(key); out.cut.push(msg); } };
  const clips = el => { const s = getComputedStyle(el); return s.overflowX !== 'visible' || s.overflowY !== 'visible'; };
  const label = el => el.tagName.toLowerCase() + '.' + String((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '').split(' ')[0];
  const gone = el => { for (let a = el; a && a !== de; a = a.parentElement) {
    const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden') return true; } return opacity(el) < 0.01; };
  const clipBox = el => { for (let a = el.parentElement; a && a !== de; a = a.parentElement) if (clips(a)) return a; return null; };
  const near = (r, box, slack) => r.left >= box.left - slack && r.right <= box.right + slack && r.top >= box.top - slack && r.bottom <= box.bottom + slack;
  const sideways = el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
  const tallerThanBox = el => {
    const extra = el.scrollHeight - el.clientHeight;
    if (el.clientWidth <= 0 || extra <= 1) return false;
    // Chromium reports the font's own ascent and descent as overflow when the line box is tighter than the font
    // (big numerals, display headings). Only non-clipping boxes in Chromium get this slack, and only up to half the
    // font size: clipping boxes stay strict in both engines, WebKit is strict for open boxes too, and a whole extra
    // line of wrapped text is always taller than half the font size, so a real overflow is never hidden by it.
    return strictVertical || extra > 0.5 * parseFloat(getComputedStyle(el).fontSize);
  };

  const texts = new Map(), used = new Map();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.trim(), el = n.parentElement;
    if (!text || !el || !el.getClientRects().length || gone(el)) continue;
    const short = '"' + text.slice(0, 32) + '"';
    { const cs = getComputedStyle(el); used.set(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim() + '|' + (cs.fontStyle === 'normal' ? 'normal' : 'italic'), 1); }
    if (sideways(el)) say(el, 'text spills sideways from ' + label(el) + ' ' + short);
    else if (!clips(el) && tallerThanBox(el)) say(el, 'text taller than its box ' + label(el) + ' ' + short);
    for (let a = el; a && a !== first.parentElement; a = a.parentElement)
      if (clips(a) && a.clientWidth > 0 && (a.scrollWidth > a.clientWidth + 1 || a.scrollHeight > a.clientHeight + 1)) say(a, 'clipping box overflows ' + label(a) + ' ' + short);
    const range = document.createRange(); range.selectNodeContents(n);
    const box = !el.closest('svg') && clipBox(el), bounds = box && box.getBoundingClientRect();
    for (const r of range.getClientRects()) {
      if (!r.width) continue;
      if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5)
        say(short + 'out', 'outside the screen ' + short + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
      if (bounds && !near(r, bounds, 0.5)) say(short + 'box', 'cut by its box ' + label(box) + ' ' + short);
    }
    if (!el.closest('svg')) {
      // The line box (the element's own box) is what a neighbour must not enter; inline text uses its own rectangle.
      const b = getComputedStyle(el).display === 'inline' ? range.getBoundingClientRect() : el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && !overlayOk.some(s => el.closest(s))) texts.set(el, { b, short });
    }
  }
  const list = Array.from(texts.entries());
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [a, x] = list[i], [c, y] = list[j];
    if (a.contains(c) || c.contains(a)) continue;
    const w = Math.min(x.b.right, y.b.right) - Math.max(x.b.left, y.b.left), h = Math.min(x.b.bottom, y.b.bottom) - Math.max(x.b.top, y.b.top);
    if (w > 1 && h > 1) say(a, 'texts overlap ' + x.short + ' and ' + y.short + ' by ' + Math.round(w) + 'x' + Math.round(h));
  }

  // The layer is designed in Bodoni Moda, Jost and Italianno: measuring fallback fonts proves nothing about what guests see.
  const loaded = Array.from(document.fonts || []).filter(f => f.status === 'loaded');
  const absent = [];
  for (const key of used.keys()) {
    const [family, style] = key.split('|');
    if (!['Bodoni Moda', 'Jost', 'Italianno'].includes(family)) continue;
    if (!loaded.some(f => f.family.replace(/["']/g, '') === family && (family !== 'Bodoni Moda' || f.style === style))) absent.push(family + (family === 'Bodoni Moda' ? ' ' + style : ''));
  }
  if (absent.length) out.missing.push('fonts not loaded: run with a network connection (' + absent.join(', ') + ')');

  // Buttons, links, pictures and svg: inside the screen and inside the box that clips them.
  for (const el of scope.querySelectorAll('button, a, img, video, svg')) {
    if (el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.closest('svg')) continue;
    if (bleedOk.some(s => el.closest(s)) || gone(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (!near(r, { left: 0, top: 0, right: vw, bottom: vh }, 0.5)) say(el, 'outside the screen ' + label(el) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
    const box = clipBox(el);
    if (box && !near(r, box.getBoundingClientRect(), 0.5)) say(el, 'sticks out of its box ' + label(el) + ' in ' + label(box));
  }
  return out;
}"""
INK_JS = r"""() => { const c = document.querySelector('#first .fm-fx'); if (!c || !c.width) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 64) if (d[i] > 0) n++; return n; }"""
DOCK_JS = "() => Array.from(document.querySelectorAll('#first .fh-dk')).map(b => [b.className.replace('fh-dk ', ''), b.textContent])"
OPT_JS = "() => Array.from(document.querySelectorAll('#first .fc-opt.fc-on .fc-opt-title')).map(e => e.textContent)"


# ---------- the server and the fixtures ----------
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256   # four browsers load the page at once; the default backlog of 5 drops connections
    daemon_threads = True


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
    server = Server(('127.0.0.1', port), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


class Fixtures:
    """Writes only files under its own tokens, and removes exactly those at the end."""

    def __init__(self):
        self.files, self.dirs = [], []
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
    def __init__(self, browser, device, label, base, shots, results, css='', block_fonts=False):
        self.browser, self.device, self.label, self.base, self.shots, self.results, self.css = browser, device, label, base, shots, results, css
        self.block_fonts = block_fonts
        self.errors, self.seen_errors, self.fails, self.context = [], 0, [], None

    async def open(self, options):
        self.context = await self.browser.new_context(**options)
        await self.context.route(REAL_DATABASE, self.refuse_database)
        if hasattr(self.context, 'route_web_socket'):
            await self.context.route_web_socket(REAL_DATABASE, self.refuse_socket)
        if self.block_fonts:
            await self.context.route(FONT_HOSTS, lambda route: route.abort())
        self.page = await self.context.new_page()
        if self.css:
            await self.page.add_init_script("document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = %s; document.head.appendChild(s); });" % json.dumps(self.css))
        self.page.on('console', self.on_console)
        self.page.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e).splitlines()[0]))
        self.page.on('response', self.on_response)
        return self.page

    async def refuse_database(self, route):
        self.fails.append('asked the real database: ' + route.request.url)
        await route.abort()

    async def refuse_socket(self, socket_route):
        self.fails.append('opened a websocket to the real database: ' + socket_route.url)
        await socket_route.close()

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

    async def stop(self, name, required):
        """Wait until every required element is visible and still, then measure the whole screen."""
        found = await self.page.evaluate(MEASURE_JS, {'required': required, 'strictVertical': self.device['engine'] == 'webkit',
                                                       'overlayOk': OVERLAY_TEXT_OK, 'bleedOk': BLEED_OK, 'driftOk': DRIFT_OK})
        new_errors = self.errors[self.seen_errors:]
        self.seen_errors = len(self.errors)
        if self.shots:
            file = re.sub(r'[^A-Za-z0-9]+', '-', '%s %s %s' % (self.device['name'], self.label, name)).strip('-') + '.png'
            await self.page.screenshot(path=os.path.join(self.shots, file))
        self.results.append({'device': self.device['name'], 'flow': self.label, 'stop': name, 'doc': found['doc'], 'card': found['card'],
                             'cut': found['cut'], 'missing': found['missing'], 'errors': new_errors})

    async def close(self):
        if self.context:
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
    await p.wait_for_timeout(300)
    f.expect(await p.locator('#first .fc').count() == 1, 'not exactly one card')


async def close_card(f):
    await f.page.keyboard.press('Escape')
    await f.page.wait_for_timeout(250)
    f.expect(await f.page.locator('#first .fc').count() == 0, 'Escape did not close the card')


async def pick_stay(f, nth):
    await f.page.click('#first .fc-opt-head >> nth=%d' % nth)
    await f.page.wait_for_timeout(300)


async def with_seen_home(f, guest, record, now=NOW):
    f.fixtures.household(guest['token'], record)
    await f.page.add_init_script("localStorage.setItem('sj-first-seen', '1')")
    await f.page.goto(f.url(guest['token'], now))
    await see_home(f.page)


def cover_required(guest):
    return COVER_NAMED if guest else COVER_NONAME


# ---------- the flows ----------
async def flow_first_visit(f, guest):
    """Cover, skip, ask, (who is coming), yes, home."""
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token']))
    await f.stop('cover', cover_required(guest))
    await watch_minute(p)
    await see_ask(p)
    await f.stop('ask', ASK)
    if len(guest['people']) > 1:
        await p.click('#first .fr-row .fr-ghost >> nth=0')
        await p.wait_for_selector('#first .fr-person', state='visible')
        await f.stop('who-is-coming', WHO)
        await p.click('#first .fr-person >> nth=1')
    else:
        await p.click('#first .fr-gold')
    await p.wait_for_selector('#first .fr-yes', state='visible')
    await p.wait_for_timeout(900)
    f.expect(await p.evaluate(INK_JS) > 0, 'no fireworks after yes')
    await f.stop('yes', YES)
    await see_home(p)
    await f.stop('home', HOME)


async def flow_full_minute(f, guest):
    """A full watch of the minute: every screen it plays, with Skip showing, then the ask."""
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token']))
    await p.wait_for_selector('#first .fm-seal', state='visible')
    await f.stop('cover-settled', COVER_NAMED)
    await p.click('#first .fm-seal')
    await f.stop('minute-title-and-dates', MINUTE_TITLE)
    await f.stop('minute-estate', MINUTE_ESTATE)
    await f.stop('minute-weekend', MINUTE_WEEKEND)
    await p.wait_for_selector('#first .fr-ask', state='visible', timeout=8000)
    await f.stop('ask-after-full-watch', ASK)


async def flow_cards(f, guest):
    """Home, then each of the six cards, and each Stay option."""
    p = f.page
    await with_seen_home(f, guest, replied(guest))
    await f.stop('home-replied', HOME)
    await open_dock(f, 0)
    await f.stop('card-reply', CARD_REPLY)
    await close_card(f)
    await open_dock(f, 1)
    for nth, name in ((0, 'stay-villa'), (1, 'stay-own'), (2, 'stay-later')):
        await pick_stay(f, nth)
        await f.stop('card-' + name, CARD_STAY)
    await pick_stay(f, 0)
    await p.click('#first .fc-go')
    await p.wait_for_selector('#first .fc', state='detached')
    await p.wait_for_timeout(500)
    await f.stop('home-after-stay', HOME)
    for nth, name, required in ((2, 'travel', CARD_TRAVEL), (3, 'wear', CARD_WEAR), (4, 'weekend', CARD_WEEKEND)):
        await open_dock(f, nth)
        await f.stop('card-' + name, required)
        await close_card(f)
    await p.click('#first .fh-link >> text=Questions')
    await p.wait_for_selector('#first .fc-questions', state='visible')
    await p.wait_for_timeout(300)
    await f.stop('card-questions', CARD_QUESTIONS)
    for i in range(await p.locator('#first .fc-q-head').count()):
        await p.click('#first .fc-q-head >> nth=%d' % i)
        await p.wait_for_timeout(700)
        await f.stop('card-questions-%d' % (i + 1), CARD_QUESTIONS)
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
    await f.stop('cant-come', ANSWERED)
    await p.click('#first .fr-center .fr-link')
    await see_ask(p)
    await f.stop('change-answer', ASK)


async def flow_closed(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], None)
    await p.goto(f.url(guest['token'], AFTER_CLOSE))
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('closed', CLOSED_SCREEN)
    await p.goto(f.url(None, AFTER_CLOSE))
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('closed-return', CLOSED_SCREEN)


async def flow_closed_replied(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], replied(guest, 'villa'))
    await p.goto(f.url(guest['token'], AFTER_CLOSE))
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('closed-already-replied', CLOSED_SCREEN)
    await see_home(p)
    await open_dock(f, 0)
    await f.stop('closed-card-reply', CARD_REPLY_CLOSED)
    await close_card(f)
    await open_dock(f, 1)
    await f.stop('closed-card-stay-fixed', CARD_STAY_FIXED)


async def flow_second_visit(f, guest):
    p = f.page
    f.fixtures.household(guest['token'], replied(guest))
    await p.goto(f.url(guest['token']))
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-center', state='visible')
    await f.stop('already-replied', ANSWERED)
    await see_home(p)
    await p.goto(f.url(None))
    await see_home(p)
    f.expect(not await p.is_visible('#first .fm-cover'), 'the minute replayed on a second visit')
    await f.stop('second-visit-home', HOME)
    f.fixtures.household(guest['token'], None)
    await p.evaluate("() => { sessionStorage.clear(); localStorage.setItem('sj-invite-kept', %s); }" % json.dumps(guest['token']))
    await p.goto(f.url(None))
    await see_ask(p)
    f.expect(await p.is_visible('#first .fr-watch'), 'no watch-again link on a second visit')
    await f.stop('second-visit-ask', ASK + ['.fr-watch'])


async def flow_no_link(f, guest):
    p = f.page
    await p.goto(f.url(None))
    await f.stop('cover', COVER_NONAME)
    await watch_minute(p)
    await p.wait_for_selector('#first .fr-nolink', state='visible')
    await f.stop('no-link', NO_LINK)
    await p.goto(f.url(None))
    await p.wait_for_selector('#first .fr-nolink', state='visible')
    await f.stop('no-link-return', NO_LINK)


async def flow_wedding_day(f, guest):
    p = f.page
    await with_seen_home(f, guest, replied(guest, 'villa'), WEDDING_DAY)
    f.expect(await p.is_visible('#first .fh-today'), 'no "today" line on the wedding day')
    await f.stop('wedding-day', HOME_WEDDING)
    await p.goto(f.url(guest['token'], DAY_AFTER))
    await see_home(p)
    await f.stop('day-after', HOME_AFTER_DAY)


async def flow_sealed_envelope(f, guest):
    p = f.page
    await with_seen_home(f, guest, replied(guest, 'villa'))
    await p.click('#first .fh-env >> nth=0')
    await p.wait_for_timeout(400)
    f.expect(await p.is_visible('#first .fh-toast'), 'no toast on a sealed envelope')
    await f.stop('sealed-before-date', TOAST)
    await p.goto(f.url(guest['token'], ESTATE_DUE))
    await see_home(p)
    await p.click('#first .fh-env >> nth=0')
    await p.wait_for_timeout(400)
    f.expect(await p.is_visible('#first .fh-toast'), 'no toast on an envelope tapped after its date')
    f.expect(await p.locator('#first .fh').count() == 1, 'left home on a sealed tap')
    await f.stop('sealed-after-date', TOAST)


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
    await f.stop('reply-saving', SAVING)
    await p.wait_for_selector('#first .fr-err', state='visible')
    await p.wait_for_timeout(700)
    f.expect(await p.evaluate('() => window.__writes') == 1, 'a double tap sent more than one reply write')
    f.expect(not await p.is_visible('#first .fr-yes'), 'moved on to yes after a failed save')
    f.expect(await p.evaluate(INK_JS) <= 0, 'fireworks after a failed save')
    f.expect(await p.evaluate("() => sjFirst.store.load(%s)" % json.dumps(guest['token'])) is None, 'a reply was recorded after a failed save')
    await f.stop('reply-save-failed', SAVE_FAILED)
    await p.evaluate("() => { sjFirst.store.saveReply = window.__real; }")
    await p.click('#first .fr-panel .fr-link >> text=' + TRY_AGAIN)
    await p.wait_for_selector('#first .fr-yes', state='visible')
    record = await p.evaluate("() => sjFirst.store.load(%s)" % json.dumps(guest['token']))
    f.expect(bool(record) and record['reply']['answer'] == 'yes', 'retry did not save the reply: %s' % record)
    await f.stop('reply-save-retried', YES)


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
    await f.stop('stay-saving', CARD + ['.fc-opt-head', '.fc-saving'])
    await p.wait_for_selector('#first .fc-note[role=alert]', state='visible')
    await p.wait_for_timeout(500)
    f.expect(await p.evaluate('() => window.__writes') == 1, 'a double tap sent more than one stay write')
    f.expect(await p.evaluate(OPT_JS) != [], 'the pick was lost after a failed save')
    dock = await p.evaluate(DOCK_JS)
    f.expect(dock[1][0] == 'fh-glow', 'the Stay dock item changed after a failed save: %s' % dock[1])
    await f.stop('stay-save-failed', CARD_STAY + ['.fc-note[role=alert]'])
    await p.evaluate("() => { sjFirst.store.saveStay = window.__real; }")
    await p.click('#first .fc-go')
    await p.wait_for_selector('#first .fc', state='detached')
    await p.wait_for_timeout(400)
    dock = await p.evaluate(DOCK_JS)
    f.expect(dock[1][0] == 'fh-done', 'retry did not mark Stay done: %s' % dock[1])
    await f.stop('stay-save-retried', HOME)


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
    await f.stop('busy-guard-done', HOME)


PER_INVITE = [('first-visit', flow_first_visit), ('cards', flow_cards), ('cant-come', flow_cant_come), ('closed', flow_closed),
              ('closed-replied', flow_closed_replied), ('second-visit', flow_second_visit)]
# (name, flow, which guest): an index into INVITES, 'spare', or None for the first invitation.
PER_DEVICE = [('no-link', flow_no_link, None), ('full-minute', flow_full_minute, 2), ('wedding-day', flow_wedding_day, 1),
              ('sealed-envelope', flow_sealed_envelope, 1), ('reply-save', flow_reply_save, 'spare'),
              ('stay-save', flow_stay_save, 'spare'), ('busy-guard', flow_busy_guard, 'spare')]


def plan(invites, spare, only=''):
    """The table of stops: every (flow, guest) pair a device runs, optionally only those whose label has `only`."""
    rows = [(guest['key'] + ' / ' + name, fn, guest) for guest in invites for name, fn in PER_INVITE]
    for name, fn, who in PER_DEVICE:
        guest = spare if who == 'spare' else invites[who] if who is not None else invites[0]
        rows.append(('everyone / ' + name, fn, guest))
    return [row for row in rows if only.lower() in row[0].lower()]


def guests_for(index, run_id):
    """Each device and each run gets its own copy of every token, so nothing is ever shared or deleted by another run."""
    def own(guest):
        return dict(guest, token='%s-%s-d%d' % (guest['token'], run_id, index))
    return [own(g) for g in INVITES], own(SPARE)


async def run_device(pw, index, base, fixtures, args, run_id):
    device, results, failures = DEVICES[index], [], []
    invites, spare = guests_for(index, run_id)
    for guest in invites + [spare]:
        fixtures.invite(guest)
    browser = await getattr(pw, device['engine']).launch()
    try:
        options = dict(pw.devices[device['preset']]) if 'preset' in device else {'viewport': device['viewport']}
        options.pop('default_browser_type', None)
        for label, fn, guest in plan(invites, spare, args.flow or ''):
            f = Flow(browser, device, label, base, args.shots, results, args.inject_css or '', args.block_fonts)
            f.fixtures = fixtures
            try:
                await f.open(options)
                await fn(f, guest)
            except Exception as e:
                f.fails.append('exception in %s: %s' % (fn.__name__, str(e).splitlines()[0] if str(e) else repr(e)))
                try:
                    await f.stop('after-exception', [])
                except Exception:
                    pass
            finally:
                await f.close()
            for message in f.fails + f.errors[f.seen_errors:]:
                failures.append('%s | %s | %s' % (device['name'], label, message))
    finally:
        await browser.close()
    return results, failures


def report(results, failures, partial=False):
    """Print one line per stop and the summary; return the exit code (0 only when every stop is clean)."""
    bad = 0
    for r in results:
        problems = r['cut'] + r['errors'] + ['required: ' + m for m in r.get('missing', [])]
        ok = not r['doc'] and not r['card'] and not problems
        bad += 0 if ok else 1
        print('%s %-16s %-52s %-26s doc=%d card=%d cut=%d missing=%d errors=%d' % ('PASS' if ok else 'FAIL', r['device'], r['flow'], r['stop'],
              r['doc'], r['card'], len(r['cut']), len(r.get('missing', [])), len(r['errors'])))
        for p in problems:
            print('       ' + p)
    for message in failures:
        print('CHECK FAILED: ' + message)
    overflow = sum(1 for r in results if r['doc'] or r['card'])
    cut = sum(len(r['cut']) for r in results)
    missing = sum(len(r.get('missing', [])) for r in results)
    errors = sum(len(r['errors']) for r in results)
    clean = bool(results) and not bad and not failures
    word = 'FAIL' if not clean else 'PARTIAL' if partial else 'PASS'
    print('%s: %d stops on %d devices, %d with overflow, %d cut-off or overlapping, %d missing required, %d console errors, %d failed checks' % (
        word, len(results), len({r['device'] for r in results}), overflow, cut, missing, errors, len(failures)))
    return 0 if clean else 1


async def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--shots', help='save a screenshot of every stop into this folder (keep it out of git)')
    parser.add_argument('--device', help='run only the devices whose name contains this text (the run is then PARTIAL)')
    parser.add_argument('--flow', help='run only the flows whose label contains this text (the run is then PARTIAL)')
    parser.add_argument('--inject-css', help='add this stylesheet to every page, to prove a check catches a fault (the run is then PARTIAL)')
    parser.add_argument('--block-fonts', action='store_true', help='refuse the font host, to prove the font check fails (the run is then PARTIAL)')
    args = parser.parse_args()
    wanted = [i for i, d in enumerate(DEVICES) if not args.device or args.device.lower() in d['name'].lower()]
    if not wanted:
        print('FAIL: no device matches %r; the devices are: %s' % (args.device, ', '.join(d['name'] for d in DEVICES)))
        return 1
    if not plan(*guests_for(0, 'x'), args.flow or ''):
        print('FAIL: no flow matches %r' % args.flow)
        return 1
    from playwright.async_api import async_playwright
    if args.shots:
        os.makedirs(args.shots, exist_ok=True)
    run_id = secrets.token_hex(3)
    server, port = start_server()
    fixtures = Fixtures()
    results, failures = [], []
    try:
        async with async_playwright() as pw:
            runs = await asyncio.gather(*[run_device(pw, i, 'http://127.0.0.1:%d/' % port, fixtures, args, run_id) for i in wanted])
        for got, bad in runs:
            results += got
            failures += bad
    finally:
        server.shutdown()
        server.server_close()
        fixtures.remove()
    return report(results, failures, partial=bool(args.device or args.flow or args.inject_css or args.block_fonts))


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
