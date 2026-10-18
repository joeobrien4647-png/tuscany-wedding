(function (root) {
  'use strict';
  function createPreview(document) {
    var ids = ['done', 'd-name', 'pr-line', 'pr-song', 'guest-card-preview', 'guest-card-name', 'guest-card-line', 'guest-card-song'];
    var nodes = ids.map(function (id) { return document.getElementById(id); });
    if (nodes.some(function (node) { return !node; })) return { refresh: function () {}, clear: function () {} };
    var done = nodes[0], name = nodes[1], line = nodes[2], song = nodes[3], card = nodes[4];
    function clear() {
      card.hidden = true;
      nodes.slice(5).forEach(function (node) { node.textContent = ''; });
    }
    function refresh() {
      var guestName = (name.textContent || '').trim();
      if (done.hidden || !guestName) { clear(); return; }
      nodes[5].textContent = guestName;
      nodes[6].textContent = line.value.trim().slice(0, 120) || 'A little about you goes here.';
      nodes[7].textContent = song.value.trim().slice(0, 120) || 'Your song goes here.';
      card.hidden = false;
    }
    line.addEventListener('input', refresh);
    song.addEventListener('input', refresh);
    clear();
    return { refresh: refresh, clear: clear };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createPreview: createPreview };
  else root.GuestCardPreview = createPreview(root.document);
})(typeof window !== 'undefined' ? window : globalThis);
