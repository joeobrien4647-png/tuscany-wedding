(function (root) {
  'use strict';
  // The book shows only when switched on in index.html, or forced with ?book=1 (?book=0 forces it off).
  function shouldShowBook({ search, enabled }) {
    const forced = new URLSearchParams(search || '').get('book');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return !!enabled;
  }
  // Joe's copy rules for every line the book shows.
  const SENTIMENTAL = /\bour story\b|\blove story\b|\bshe said yes\b|\bhappily ever after\b|\bsoul ?mates?\b|\bfairy ?tale\b|\bmeant to be\b|\btrue love\b/i;
  function copyProblems(text) {
    const s = String(text || ''), problems = [];
    if (s.includes('—')) problems.push('em dash');
    if (s.includes('·')) problems.push('middle dot');
    if (/\.\s*$/.test(s)) problems.push('trailing full stop');
    if (SENTIMENTAL.test(s)) problems.push('sentimental');
    return problems;
  }
  const api = { shouldShowBook, copyProblems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Storybook = api;
})(typeof window !== 'undefined' ? window : globalThis);
