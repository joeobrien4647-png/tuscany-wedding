"""Makes the link preview picture (images/first/share-preview.jpg, 1200 x 630) from the villa photo.

    PYTHONIOENCODING=utf-8 python scripts/make-share-preview.py

Needs Python Playwright with Chromium and a network connection (the fonts come from Google Fonts).
Fails with exit 1, saying why, if a font did not load, if the names, the place or the date line is wider than
560 px (so a centred square crop of 630 x 630 still shows them), or if the file cannot be made 250 KB or smaller
at JPEG quality 60 or better. The page is only a temporary file and is removed.
"""
import asyncio, pathlib, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
PHOTO = ROOT / 'images' / 'first' / 'villa.webp'
OUT = ROOT / 'images' / 'first' / 'share-preview.jpg'
PHOTO_POSITION = '50% 55%'
MAX_LINE_WIDTH = 560
MAX_BYTES = 250 * 1024
QUALITY_START, QUALITY_STEP, QUALITY_FLOOR = 88, 4, 60
NAMES_SIZE_START, NAMES_SIZE_STEP, NAMES_SIZE_FLOOR = 190, 4, 100
FONTS = ["400 100px 'Italianno'", "400 44px 'Bodoni Moda'", "400 30px 'Jost'"]

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link href="__FONTS__" rel="stylesheet">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0a0d16; }
  .pic { position: absolute; top: 0; left: 0; width: 1200px; height: 630px; object-fit: cover; object-position: __POS__; }
  .shade { position: absolute; top: 0; left: 0; width: 1200px; height: 630px;
    background: radial-gradient(ellipse 62% 78% at 50% 52%, rgba(10,13,22,.80) 0%, rgba(10,13,22,.58) 52%, rgba(10,13,22,.30) 100%); }
  .frame { position: absolute; top: 26px; left: 26px; width: 1146px; height: 576px; border: 1px solid rgba(243,218,156,.55); }
  .words { position: absolute; top: 0; left: 0; width: 1200px; height: 630px; display: grid; align-content: center; justify-items: center; text-align: center; }
  .names { font-family: 'Italianno', cursive; font-size: __NAMES__px; line-height: .9; color: #f3da9c; text-shadow: 0 2px 26px rgba(0,0,0,.55); margin: 0; white-space: nowrap; }
  .amp { margin: 0 __AMP_RIGHT__em 0 __AMP_LEFT__em; }
  .rule { width: 120px; height: 1px; background: #dcb76d; margin: 30px 0 26px; }
  .place { font-family: 'Bodoni Moda', serif; font-size: 44px; letter-spacing: .34em; margin: 0 -.34em 0 0; color: #f5ecdc; text-transform: uppercase; white-space: nowrap; }
  .date { font-family: 'Jost', sans-serif; font-weight: 400; font-size: 30px; letter-spacing: .16em; margin: 18px -.16em 0 0; color: #f5ecdc; text-transform: uppercase; white-space: nowrap; }
</style></head><body>
<img class="pic" src="__SRC__"><div class="shade"></div><div class="frame"></div>
<div class="words"><p class="names">Sophie <span class="amp">&amp;</span> Joe</p><div class="rule"></div><p class="place">Tuscany</p><p class="date">Saturday 29 May 2027</p></div>
</body></html>"""

FONTS_URL = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400..700&family=Italianno&family=Jost:wght@300..600&display=swap'
AMP_LEFT_EM, AMP_RIGHT_EM = "-.01", ".25"


def fail(message):
    print('FAILED: ' + message, file=sys.stderr)
    sys.exit(1)


async def load_page(page, folder, names_size):
    html = (PAGE.replace('__POS__', PHOTO_POSITION).replace('__NAMES__', str(names_size))
            .replace("__AMP_LEFT__", AMP_LEFT_EM).replace("__AMP_RIGHT__", AMP_RIGHT_EM).replace('__SRC__', PHOTO.as_uri()).replace('__FONTS__', FONTS_URL))
    path = pathlib.Path(folder) / 'preview.html'
    path.write_text(html, encoding='utf-8')
    await page.goto(path.as_uri(), wait_until='networkidle')
    await page.evaluate('document.fonts.ready')
    await page.wait_for_timeout(600)


async def check_fonts(page):
    for font in FONTS:
        if not await page.evaluate('f => document.fonts.check(f)', font):
            fail('the font ' + font + ' did not load (is the network up?), so the picture would use a default font')


async def line_widths(page):
    return await page.evaluate("""() => Object.fromEntries(['names', 'place', 'date'].map(
        c => [c, document.querySelector('.' + c).getBoundingClientRect().width]))""")


async def render(page, folder):
    names_size = NAMES_SIZE_START
    while True:
        await load_page(page, folder, names_size)
        await check_fonts(page)
        widths = await line_widths(page)
        if widths['place'] > MAX_LINE_WIDTH or widths['date'] > MAX_LINE_WIDTH:
            fail('a line is wider than %d px: %s' % (MAX_LINE_WIDTH, widths))
        if widths['names'] <= MAX_LINE_WIDTH:
            return names_size, widths
        names_size -= NAMES_SIZE_STEP
        if names_size < NAMES_SIZE_FLOOR:
            fail('the names do not fit in %d px at any size down to %d px' % (MAX_LINE_WIDTH, NAMES_SIZE_FLOOR))


async def save_small_enough(page):
    quality, tried = QUALITY_START, None
    while quality >= QUALITY_FLOOR:
        tried = quality
        data = await page.screenshot(type='jpeg', quality=quality)
        if len(data) <= MAX_BYTES:
            OUT.write_bytes(data)
            return quality, len(data)
        quality -= QUALITY_STEP
    fail('the picture is over %d bytes even at quality %d' % (MAX_BYTES, tried))


async def main():
    from playwright.async_api import async_playwright
    if not PHOTO.exists():
        fail('the villa photo is missing: ' + str(PHOTO))
    with tempfile.TemporaryDirectory() as folder:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
            names_size, widths = await render(page, folder)
            quality, size = await save_small_enough(page)
            await browser.close()
    print('names font size %d px; line widths %s' % (names_size, {k: round(v, 1) for k, v in widths.items()}))
    print('saved %s: %d bytes at JPEG quality %d' % (OUT.relative_to(ROOT).as_posix(), size, quality))


asyncio.run(main())
