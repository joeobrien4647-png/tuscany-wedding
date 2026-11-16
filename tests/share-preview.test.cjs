const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

test('the link preview picture is a 1200 x 630 JPEG of at most 250 KB', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'images', 'first', 'share-preview.jpg'));
  assert.equal(buf.readUInt16BE(0), 0xffd8);
  assert.deepEqual(jpegSize(buf), [1200, 630]);
  assert.ok(buf.length <= 250 * 1024, 'size ' + buf.length);
});

test('the page still points at the save-the-date picture until the switch flips', () => {
  const html = read('index.html');
  assert.match(html, /<meta property="og:image" content="https:\/\/sophieandjoe2027\.com\/images\/save-the-date\/share-preview\.jpg">/);
  assert.doesNotMatch(html, /images\/first\/share-preview/);
});

test('the preview script is in the repo, makes the picture from the villa photo, and names no local folder', () => {
  const py = read('scripts/make-share-preview.py');
  for (const s of ['villa.webp', 'share-preview.jpg', 'Italianno', 'Bodoni Moda', 'Jost', '250', '560']) assert.ok(py.includes(s), s);
  assert.doesNotMatch(py, /[A-Za-z]:[\/]|Users[\/]|dev-scratch/);
});
