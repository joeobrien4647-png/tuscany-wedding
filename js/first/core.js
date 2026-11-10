(function (root) {
  'use strict';
  // The invitation layer shows only when switched on in index.html, or forced with ?first=1 (?first=0 forces it off).
  // A password reset link (?signin=1) always goes straight to Sign in.
  function shouldShowFirst({ search, enabled, signingIn }) {
    if (signingIn) return false;
    const forced = new URLSearchParams(search || '').get('first');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return !!enabled;
  }

  const SENTIMENTAL = /\bour story\b|\blove story\b|\bshe said yes\b|\bhappily ever after\b|\bsoul ?mates?\b|\bfairy ?tale\b|\bmeant to be\b|\btrue love\b/i;
  // Copy rules for every guest-facing line: same four checks as js/storybook.js.
  function copyProblems(text) {
    const s = String(text || ''), problems = [];
    if (s.includes(String.fromCharCode(0x2014))) problems.push('em dash');
    if (s.includes(String.fromCharCode(0xb7))) problems.push('middle dot');
    if (/\.\s*$/.test(s)) problems.push('trailing full stop');
    if (SENTIMENTAL.test(s)) problems.push('sentimental');
    return problems;
  }

  const api = { shouldShowFirst, copyProblems };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
