(function (root) {
  'use strict';
  function createFirebaseStub(storage) {
    var data = {}, listeners = [], queue = [], history = [], counter = 0, accounts = {}, restored = null;
    try { restored = storage && JSON.parse(storage.getItem('sj-fictional-fixture') || 'null'); } catch (error) {}
    if (restored) { data = restored.data || {}; counter = restored.counter || 0; accounts = restored.accounts || {}; }
    function persist() {
      if (storage) { try { storage.setItem('sj-fictional-fixture', JSON.stringify({ data: data, user: auth && auth.currentUser, counter: counter, accounts: accounts })); } catch (error) {} }
    }
    function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
    function parts(path) { return path.split('/').filter(Boolean); }
    function get(path) { return parts(path).reduce(function (value, key) { return value && value[key]; }, data); }
    function put(path, value) {
      var keys = parts(path), last = keys.pop(), parent = data;
      keys.forEach(function (key) { parent = parent[key] || (parent[key] = {}); });
      if (value === null) delete parent[last]; else parent[last] = clone(value);
    }
    function operation(method, path, action) {
      history.push({ method: method, path: path });
      var index = queue.findIndex(function (item) { return item.method === method && (!item.path || item.path === path); });
      var next = index < 0 ? null : queue.splice(index, 1)[0];
      return Promise.resolve(next && next.wait).then(function () {
        if (next && next.error) throw next.error;
        return action();
      });
    }
    function ref(path, options) {
      options = options || {};
      return {
        key: parts(path).slice(-1)[0],
        orderByKey: function () { return ref(path, options); },
        startAt: function (key) { return ref(path, Object.assign({}, options, { start: key })); },
        limitToFirst: function (limit) { return ref(path, Object.assign({}, options, { limit: limit })); },
        child: function (key) { return ref(path + '/' + key); },
        once: function () { return operation('once', path, function () {
          var value = clone(get(path));
          if (value && (options.start || options.limit)) {
            var filtered = {};
            Object.keys(value).sort().filter(function (key) { return !options.start || key >= options.start; }).slice(0, options.limit || Infinity).forEach(function (key) { filtered[key] = value[key]; });
            value = filtered;
          }
          return { exists: function () { return value != null; }, val: function () { return value == null ? null : value; },
            forEach: function (fn) { Object.keys(value || {}).forEach(function (key) { fn({ key: key, val: function () { return value[key]; } }); }); } };
        }); },
        set: function (value) { return operation('set', path, function () { put(path, value); persist(); }); },
        update: function (value) { return operation('update', path, function () {
          Object.keys(value).forEach(function (key) { put(path + '/' + key, value[key]); }); persist();
        }); },
        remove: function () { return operation('remove', path, function () { put(path, null); persist(); }); },
        push: function (value) { var child = ref(path + '/fixture-' + (++counter)); return value === undefined ? child : child.set(value).then(function () { return child; }); }
      };
    }
    function user(value) {
      return Object.assign({ uid: 'fictional-guest', email: 'guest@example.test', displayName: 'Fictional Guest', providerData: [],
        updateProfile: function (profile) { Object.assign(auth.currentUser, profile); return Promise.resolve(); } }, value);
    }
    function change(value) { auth.currentUser = value ? user(value) : null; if (auth.currentUser && auth.currentUser.email) accounts[auth.currentUser.email] = { uid: auth.currentUser.uid, email: auth.currentUser.email, displayName: auth.currentUser.displayName }; persist(); listeners.slice().forEach(function (fn) { fn(auth.currentUser); }); return auth.currentUser; }
    var auth = {
      currentUser: restored && restored.user ? user(restored.user) : null,
      onAuthStateChanged: function (fn) { listeners.push(fn); Promise.resolve().then(function () { fn(auth.currentUser); }); return function () { listeners = listeners.filter(function (entry) { return entry !== fn; }); }; },
      createUserWithEmailAndPassword: function (email) { return operation('createUser', email, function () { if (accounts[email]) { var error = new Error('Fictional account exists'); error.code = 'auth/email-already-in-use'; throw error; } return { user: change({ uid: 'fictional-' + (++counter), email: email, displayName: '' }) }; }); },
      signInWithEmailAndPassword: function (email) { return operation('signIn', email, function () { return { user: change(accounts[email] || { email: email }) }; }); },
      signInWithPopup: function () { return operation('popup', '', function () { return { user: change({ providerData: [{ providerId: 'google.com' }] }) }; }); },
      signOut: function () { change(null); return Promise.resolve(); },
      sendPasswordResetEmail: function () { return Promise.resolve(); }
    };
    var authFactory = function () { return auth; }; authFactory.GoogleAuthProvider = function () {};
    var databaseFactory = function () { return { ref: ref }; }; databaseFactory.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
    return { firebase: { initializeApp: function () {}, auth: authFactory, database: databaseFactory },
      seed: function (value) { data = clone(value); persist(); }, signIn: change, signOut: function () { change(null); },
      failNext: function (method, path, message) { queue.push({ method: method, path: path, error: new Error(message || 'Fictional connection failure') }); },
      delayNext: function (method, path) { var release; var wait = new Promise(function (resolve) { release = resolve; }); queue.push({ method: method, path: path, wait: wait }); return release; },
      inspect: function () { return clone(data); }, history: history };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = createFirebaseStub;
  else if (!root.__firebaseStub) { root.__firebaseStub = createFirebaseStub(root.sessionStorage); root.firebase = root.__firebaseStub.firebase; }
})(typeof window !== 'undefined' ? window : globalThis);
