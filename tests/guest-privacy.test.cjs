const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase.rules.json'), 'utf8')).rules;
const admin = "auth != null && root.child('admins').child(auth.uid).exists()";
const ownerOrAdmin = "auth != null && (auth.uid === $uid || root.child('admins').child(auth.uid).exists())";

test('retired guest profiles have no read or write grant below the admin-only root', () => {
  assert.equal(rules['.read'], admin);
  assert.equal(rules['.write'], admin);
  assert.equal(rules.public['.read'], undefined, 'a public ancestor grant would bypass profile restrictions');
  assert.equal(rules.public['.write'], undefined);
  function check(node) {
    for (const [key, value] of Object.entries(node)) {
      assert.ok(key !== '.read' && key !== '.write', `profiles cannot grant ${key}`);
      if (value && typeof value === 'object') check(value);
    }
  }
  check(rules.public.profiles);
  assert.deepEqual(rules.public.config, { '.read': true });
});

test('privacy cleanup preserves the live registration, contribution, payment and member policy', () => {
  assert.deepEqual(rules.registrations, { '$uid': {
    '.read': ownerOrAdmin, '.write': ownerOrAdmin,
    '.validate': "newData.hasChildren(['name', 'email', 'intent'])"
  }});
  assert.deepEqual(rules.payments, { '$uid': { '.read': ownerOrAdmin }});
  assert.equal(rules.members['.read'], undefined, 'a members-wide grant would show the bank details to anyone who signs up');
  assert.deepEqual(rules.members.payment, { '.read': "auth != null && root.child('approved').child(auth.uid).val() === true" });
  assert.deepEqual(rules.approved, { '$uid': { '.validate': 'newData.isBoolean()' } }, 'only admins, through the root grant, can approve');
});
