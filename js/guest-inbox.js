(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.GuestInbox = api; api.mount(root); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var PAGE_SIZE = 20;
  function acknowledged(operation, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('We could not confirm the request in time.')); }, timeoutMs);
      Promise.resolve(operation).then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }
  function createController(options) {
    var db = options.db, epoch = 0, cursor = null, state, user = null, timeoutMs = options.timeoutMs || 15000;
    function emit() { if (options.onChange) options.onChange(state); }
    function fresh(status) { return { status: status, rows: [], hasMore: true, loading: false, loaded: false }; }
    async function setUser(nextUser) {
      var ticket = ++epoch; user = nextUser; cursor = null;
      state = fresh(user ? 'checking' : 'signed-out'); emit();
      if (!user) return;
      try {
        var admin = await acknowledged(db.ref('admins/' + user.uid).once('value'), timeoutMs);
        if (ticket !== epoch) return;
        state.status = admin.exists() ? 'ready' : 'denied'; emit();
      } catch (error) { if (ticket === epoch) { state.status = 'auth-error'; emit(); } }
    }
    async function loadNext() {
      if (!user || !['ready', 'read-error'].includes(state.status) || state.loading || !state.hasMore) return;
      var ticket = epoch, previous = cursor;
      state.loading = true; state.status = 'ready'; emit();
      try {
        var query = db.ref('registrations').orderByKey();
        if (cursor !== null) query = query.startAt(cursor);
        var snapshot = await acknowledged(query.limitToFirst(PAGE_SIZE + 1).once('value'), timeoutMs);
        if (ticket !== epoch) return;
        var records = [];
        snapshot.forEach(function (child) { if (child.key !== previous) records.push({ key: child.key, value: child.val() }); });
        // startAt includes the previous cursor. An exact full page may need one final empty read.
        state.hasMore = previous === null ? records.length > PAGE_SIZE : records.length >= PAGE_SIZE;
        records.slice(0, PAGE_SIZE).forEach(function (record) {
          cursor = record.key;
          var contributions = record.value && record.value.contributions;
          var sender = record.value && typeof record.value.name === 'string' ? record.value.name.trim().slice(0, 120) : '';
          ['song', 'memory'].forEach(function (kind) {
            var item = contributions && contributions[kind];
            if (item && typeof item.text === 'string' && item.text.trim()) state.rows.push({ kind: kind, sender: sender || 'Unnamed guest', text: item.text.slice(0, kind === 'song' ? 240 : 4000), updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : null });
          });
        });
        state.loaded = true;
      } catch (error) { if (ticket === epoch) state.status = 'read-error'; }
      finally { if (ticket === epoch) { state.loading = false; emit(); } }
    }
    state = fresh('checking');
    return { setUser: setUser, reload: function () { return setUser(user); }, loadNext: loadNext, getState: function () { return state; } };
  }
  function mount(win) {
    var doc = win.document, status = doc.getElementById('inbox-status');
    if (!status) return;
    var list = doc.getElementById('inbox-items'), load = doc.getElementById('inbox-load'), retry = doc.getElementById('inbox-retry'), signin = doc.getElementById('inbox-signin');
    function fail() { if (controller) controller.setUser(null); list.replaceChildren(); status.textContent = 'We could not connect. Reload this page to try again.'; load.hidden = true; }
    if (!win.firebase) { fail(); return; }
    try {
      if (!win.firebase.apps || !win.firebase.apps.length) win.firebase.initializeApp({ apiKey: 'AIzaSyAbEpCIPFFqiuElH0DK1dkkl7JBbNyZTc8', databaseURL: 'https://tuscany-wedding-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'tuscany-wedding' });
      var controller = createController({ db: win.firebase.database(), onChange: render });
      function render(state) {
        var messages = { checking: 'Checking organiser access…', 'signed-out': 'Sign in with your organiser account to continue.', denied: 'This inbox is only available to the organisers.', 'auth-error': 'We could not verify organiser access. No guest contributions have been loaded.', 'read-error': 'We could not load the next page. Retry to continue.' };
        status.textContent = messages[state.status] || (state.loading ? 'Loading contributions…' : !state.loaded ? 'Access verified. Load the first page when you are ready.' : state.rows.length ? 'Loaded ' + state.rows.length + ' contributions.' + (state.hasMore ? ' More guest records can be checked below.' : ' All guest records have been checked.') : state.hasMore ? 'No contributions in the records checked so far. Continue to check the next page.' : 'No contributions found.');
        signin.hidden = state.status !== 'signed-out';
        retry.hidden = state.status !== 'auth-error';
        load.hidden = !['ready', 'read-error'].includes(state.status) || !state.hasMore;
        load.disabled = state.loading;
        load.textContent = state.loading ? 'Loading…' : state.status === 'read-error' ? 'Retry this page' : state.loaded ? 'Check next 20 guest records' : 'Load contributions';
        list.replaceChildren();
        state.rows.forEach(function (item) {
          var card = doc.createElement('article'), title = doc.createElement('h2'), body = doc.createElement('p');
          card.className = 'guest-card'; title.textContent = item.sender + ' · ' + (item.kind === 'song' ? 'Song request' : 'Memory');
          body.textContent = item.text; body.style.whiteSpace = 'pre-wrap';
          card.append(title, body);
          if (item.updatedAt) { var time = doc.createElement('p'); time.textContent = 'Saved ' + new Date(item.updatedAt).toLocaleDateString('en-GB'); card.append(time); }
          list.append(card);
        });
      }
      load.addEventListener('click', function () { controller.loadNext(); });
      retry.addEventListener('click', function () { controller.reload(); });
      render(controller.getState());
      win.firebase.auth().onAuthStateChanged(function (user) { controller.setUser(user); }, fail);
    } catch (error) { fail(); }
  }
  return { createController: createController, mount: mount };
}));
