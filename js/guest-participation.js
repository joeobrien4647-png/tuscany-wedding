(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.GuestParticipation = api; api.mount(root); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var LIMITS = { song: 240, memory: 4000 };
  function acknowledged(operation, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { var error = new Error('We could not confirm the request in time.'); error.code = 'acknowledgement-timeout'; reject(error); }, timeoutMs);
      Promise.resolve(operation).then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }
  function createController(options) {
    var db = options.db, epoch = 0, user = null, state, timeoutMs = options.timeoutMs || 15000;
    function fresh(status) { return { status: status, drafts: { song: '', memory: '' }, saved: { song: false, memory: false }, saving: { song: false, memory: false }, feedback: { song: '', memory: '' } }; }
    function emit() { if (options.onChange) options.onChange(state); }
    function setDraft(kind, text) { if (Object.prototype.hasOwnProperty.call(LIMITS, kind) && state.status === 'ready') { state.drafts[kind] = text; state.feedback[kind] = ''; } }
    async function setUser(nextUser) {
      var ticket = ++epoch;
      user = nextUser;
      state = fresh(user ? 'loading' : 'signed-out'); emit();
      if (!user) return;
      var uid = user.uid;
      try {
        var snapshot = await acknowledged(db.ref('registrations/' + uid).once('value'), timeoutMs);
        if (ticket !== epoch) return;
        var record = snapshot.val();
        if (!record || typeof record.name !== 'string' || !record.name.trim() || typeof record.email !== 'string' || !record.email.trim() || !['yes', 'maybe', 'no'].includes(record.intent)) {
          state.status = 'registration-required'; emit(); return;
        }
        ['song', 'memory'].forEach(function (kind) {
          var item = record.contributions && record.contributions[kind];
          if (item && typeof item.text === 'string') { state.drafts[kind] = item.text.slice(0, LIMITS[kind]); state.saved[kind] = true; }
        });
        state.status = 'ready'; emit();
      } catch (error) { if (ticket === epoch) { state.status = 'read-error'; emit(); } }
    }
    async function save(kind, text) {
      if (!user || state.status !== 'ready') throw new Error('Complete your registration before saving.');
      if (!Object.prototype.hasOwnProperty.call(LIMITS, kind)) throw new Error('Unknown contribution type.');
      if (state.saving[kind]) throw new Error('Already saving.');
      state.drafts[kind] = String(text);
      var value = state.drafts[kind].trim();
      if (!value || value.length > LIMITS[kind]) {
        state.feedback[kind] = 'invalid'; emit();
        throw new Error('Please enter between 1 and ' + LIMITS[kind] + ' characters.');
      }
      var ticket = epoch, uid = user.uid;
      state.saving[kind] = true; state.feedback[kind] = 'saving'; emit();
      try {
        await acknowledged(db.ref('registrations/' + uid + '/contributions/' + kind).update({ text: value, updatedAt: options.timestamp === undefined ? Date.now() : options.timestamp }), timeoutMs);
        if (ticket === epoch) { state.saved[kind] = true; state.feedback[kind] = 'saved'; }
      } catch (error) {
        if (ticket === epoch) state.feedback[kind] = error.code === 'acknowledgement-timeout' ? 'uncertain' : 'error';
        throw error;
      } finally { if (ticket === epoch) { state.saving[kind] = false; emit(); } }
    }
    state = fresh('loading');
    return { setUser: setUser, reload: function () { return setUser(user); }, save: save, setDraft: setDraft, getState: function () { return state; } };
  }
  function mount(win) {
    var doc = win.document, status = doc.getElementById('participation-status');
    if (!status) return;
    var forms = doc.getElementById('participation-forms'), signin = doc.getElementById('participation-signin'), retry = doc.getElementById('participation-retry');
    function fail() {
      if (controller) controller.setUser(null);
      forms.hidden = true;
      status.textContent = 'We could not connect. Reload this page to try again. Your saved contributions have not changed.';
    }
    if (!win.firebase) { fail(); return; }
    try {
      if (!win.firebase.apps || !win.firebase.apps.length) win.firebase.initializeApp({ apiKey: 'AIzaSyAbEpCIPFFqiuElH0DK1dkkl7JBbNyZTc8', databaseURL: 'https://tuscany-wedding-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'tuscany-wedding' });
      var controller = createController({ db: win.firebase.database(), timestamp: win.firebase.database.ServerValue.TIMESTAMP, onChange: render });
      function render(state) {
        var messages = { loading: 'Checking your account…', 'signed-out': 'Sign in to save a song request or memory.', 'registration-required': 'Finish your registration before adding a song request or memory.', 'read-error': 'We could not load your contributions. Please try again.', ready: 'Your song request and memory are visible to you and the website administrators.' };
        status.textContent = messages[state.status];
        forms.hidden = state.status !== 'ready';
        signin.hidden = state.status !== 'signed-out' && state.status !== 'registration-required';
        signin.textContent = state.status === 'registration-required' ? 'Finish my registration' : 'Sign in / register';
        retry.hidden = state.status !== 'read-error';
        ['song', 'memory'].forEach(function (kind) {
          var field = doc.getElementById(kind + '-text'), button = doc.getElementById(kind + '-save');
          if (field.value !== state.drafts[kind]) field.value = state.drafts[kind];
          field.disabled = state.status !== 'ready' || state.saving[kind];
          button.disabled = state.status !== 'ready' || state.saving[kind];
          button.textContent = state.saving[kind] ? 'Saving…' : (state.saved[kind] ? 'Save changes' : 'Save ' + (kind === 'song' ? 'song request' : 'memory'));
          var feedback = { saving: 'Saving…', saved: 'Saved. You can edit this whenever you like.', invalid: 'Please add some text within the character limit before saving.', error: 'We could not confirm your save. Your draft is still here. Press Save to retry safely.', uncertain: 'The connection is taking too long to confirm your save. It may still arrive. Your draft is here; press Save to retry safely without creating another entry.' };
          doc.getElementById(kind + '-status').textContent = feedback[state.feedback[kind]] || '';
        });
      }
      ['song', 'memory'].forEach(function (kind) {
        doc.getElementById(kind + '-text').addEventListener('input', function (event) { controller.setDraft(kind, event.target.value); doc.getElementById(kind + '-status').textContent = 'Unsaved changes.'; });
        doc.getElementById(kind + '-form').addEventListener('submit', function (event) {
          event.preventDefault();
          controller.save(kind, doc.getElementById(kind + '-text').value).catch(function () { /* The controller preserves the draft and displays retry feedback. */ });
        });
      });
      retry.addEventListener('click', function () { controller.reload(); });
      render(controller.getState());
      win.firebase.auth().onAuthStateChanged(function (user) { controller.setUser(user); }, fail);
    } catch (error) { fail(); }
  }
  return { createController: createController, mount: mount };
}));
