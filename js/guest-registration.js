(function (root) {
  'use strict';
  function createSession(auth, db, options) {
    var timeoutMs = options && options.timeoutMs || 15000;
    function acknowledged(promise, writing) {
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          var error = new Error(writing ? 'We could not confirm that your reply was saved.' : 'Your saved reply could not load. Try again.');
          error.code = writing ? 'registration/uncertain' : 'registration/read-timeout'; reject(error);
        }, timeoutMs);
        promise.then(function (result) { clearTimeout(timer); resolve(result); }, function (error) { clearTimeout(timer); reject(error); });
      });
    }
    var uid = null, epoch = 0, read = 0, state = { status: 'signed-out', record: null }, pending = null;
    function valid(id, version) { return uid === id && epoch === version && auth.currentUser && auth.currentUser.uid === id; }
    function setUser(user) {
      var next = user && user.uid;
      if (next === uid) return;
      uid = next; epoch++; read++; pending = null;
      state = { status: uid ? 'loading' : 'signed-out', record: null };
    }
    function load() {
      var id = uid, version = epoch, request = ++read;
      if (!id) return Promise.resolve(state);
      return acknowledged(db.ref('registrations/' + id).once('value'), false).then(function (snapshot) {
        if (!valid(id, version) || request !== read) return { status: 'stale' };
        state = { status: snapshot.exists() ? 'saved' : 'missing', record: snapshot.val() };
        return state;
      }).catch(function (error) {
        if (!valid(id, version) || request !== read) return { status: 'stale' };
        state = { status: 'error', record: null, error: error }; return state;
      });
    }
    function save(fields) {
      if (pending) return pending;
      var id = uid, version = epoch;
      if (!id || !valid(id, version)) return Promise.reject(new Error('Sign in before saving.'));
      var operation = acknowledged(db.ref('registrations/' + id).once('value'), false).then(function (snapshot) {
        if (!valid(id, version)) return { status: 'stale' };
        var existing = snapshot.val() || {}, update = Object.assign({}, fields, { uid: id, updatedAt: root.firebase ? root.firebase.database.ServerValue.TIMESTAMP : { '.sv': 'timestamp' } });
        if (!snapshot.exists()) update.createdAt = update.updatedAt;
        return acknowledged(db.ref('registrations/' + id).update(update), true).then(function () {
          if (!valid(id, version)) return { status: 'stale' };
          read++;
          state = { status: 'saved', record: Object.assign({}, existing, update) }; return state;
        });
      });
      pending = operation;
      operation.then(clear, clear);
      function clear() { if (pending === operation) pending = null; }
      return operation;
    }
    return { setUser: setUser, load: load, save: save, state: function () { return state; } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createSession: createSession };
  else root.GuestRegistration = { createSession: createSession };
})(typeof window !== 'undefined' ? window : globalThis);
