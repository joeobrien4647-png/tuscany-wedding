// Writes every retired page from data/retired-routes.json: a short page that sends the guest on to its target.
// Run from the repo root: node scripts/retire-pages.cjs (add --check to list pages that differ without writing).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'data/retired-routes.json'), 'utf8'));

function retiredPage(target) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="color-scheme" content="only light">',
    '  <meta name="robots" content="noindex">',
    `  <meta http-equiv="refresh" content="0;url=${target}">`,
    `  <link rel="canonical" href="https://sophieandjoe2027.com/${target}">`,
    '  <title>Wedding information, Sophie &amp; Joe</title>',
    '  <link rel="stylesheet" href="css/guest-journey.css">',
    '  <link rel="stylesheet" href="css/postcards.css">',
    '</head>',
    '<body class="guest-page postcard-page">',
    '  <main class="guest-main">',
    '    <h1>Sophie &amp; Joe</h1>',
    '    <p>Our wedding information is now together in one place.</p>',
    `    <p><a class="guest-button" href="${target}">Continue to the wedding website</a></p>`,
    '  </main>',
    '</body>',
    '</html>',
    ''
  ].join('\r\n');
}

const check = process.argv.includes('--check');
const differ = [];
for (const [file, target] of Object.entries(routes)) {
  const want = retiredPage(target);
  const at = path.join(root, file);
  const have = fs.existsSync(at) ? fs.readFileSync(at, 'utf8') : '';
  if (have === want) continue;
  differ.push(file);
  if (!check) fs.writeFileSync(at, want, 'utf8');
}
console.log((check ? 'differ: ' : 'written: ') + (differ.length ? differ.join(' ') : 'none'));
