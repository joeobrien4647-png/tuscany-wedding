(function (root) {
  'use strict';
  function createWelcome(document) {
    var ids = ['done', 'd-name', 'guest-welcome', 'guest-welcome-name', 'guest-welcome-note', 'guest-welcome-link', 'guest-welcome-reply', 'reply-action'];
    var nodes = ids.map(function (id) { return document.getElementById(id); });
    if (nodes.some(function (node) { return !node; })) return { refresh: function () {}, clear: function () {} };
    var welcome = nodes[2], name = nodes[3], note = nodes[4], link = nodes[5], reply = nodes[6];
    function clear() {
      welcome.hidden = true;
      name.textContent = ''; note.textContent = ''; link.textContent = '';
      link.removeAttribute('href'); link.hidden = true; reply.hidden = true;
    }
    function refresh(intent) {
      clear();
      var savedName = (nodes[1].textContent || '').trim();
      if (nodes[0].hidden || !savedName) return;
      name.textContent = savedName;
      if (intent === 'yes') {
        note.textContent = 'A whole weekend together in the Tuscan hills. We are so glad you will be part of it.';
        link.textContent = 'Take a look at the weekend';
        link.setAttribute('href', 'weekend-guide.html'); link.hidden = false;
      } else if (intent === 'no') {
        note.textContent = 'We will miss you. There is still a little of our world here for you, wherever you are.';
        link.textContent = 'A little more us';
        link.setAttribute('href', 'our-world.html'); link.hidden = false;
      } else {
        note.textContent = 'Still working out your plans? Your reply is here whenever you are ready to update it.';
        reply.hidden = false;
      }
      welcome.hidden = false;
    }
    reply.addEventListener('click', function () { nodes[7].click(); });
    clear();
    return { refresh: refresh, clear: clear };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createWelcome: createWelcome };
  else root.GuestWelcome = createWelcome(root.document);
})(typeof window !== 'undefined' ? window : globalThis);
