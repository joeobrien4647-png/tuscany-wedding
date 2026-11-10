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

  const api = { shouldShowFirst };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
