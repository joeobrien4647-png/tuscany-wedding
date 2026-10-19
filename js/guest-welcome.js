(function (root) {
  'use strict';
  function createWelcome(document) {
    var ids = ['done', 'd-name', 'guest-welcome'];
    var nodes = ids.map(function (id) { return document.getElementById(id); });
    if (nodes.some(function (node) { return !node; })) return { refresh: function () {}, clear: function () {} };
    var welcome = nodes[2];
    function clear() {
      welcome.hidden = true;
      welcome.textContent = '';
    }
    function refresh(intent) {
      clear();
      var savedName = (nodes[1].textContent || '').trim();
      if (nodes[0].hidden || !savedName) return;
      welcome.textContent = savedName + (intent === 'yes' ? ', see you in Tuscany.' : ', thank you for letting us know.');
      welcome.hidden = false;
    }
    clear();
    return { refresh: refresh, clear: clear };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createWelcome: createWelcome };
  else root.GuestWelcome = createWelcome(root.document);
})(typeof window !== 'undefined' ? window : globalThis);
