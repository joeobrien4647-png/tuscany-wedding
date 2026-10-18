const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('phone navigation yields space to editing and returns when leaving a field', () => {
  const events = {}, classes = new Set();
  const document = {
    body: {classList: {toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }}},
    addEventListener(name, handler) { events[name] = handler; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/guest-navigation.js'), 'utf8'), {document});
  const input = {matches(selector) { assert.ok(selector.includes('textarea')); return true; }};
  const action = {matches() { return false; }};
  events.focusin({target: input});
  assert.ok(classes.has('postcard-editing'));
  events.focusout({relatedTarget: input});
  assert.ok(classes.has('postcard-editing'));
  events.focusout({relatedTarget: action});
  assert.ok(!classes.has('postcard-editing'));
  events.focusin({target: action});
  assert.ok(!classes.has('postcard-editing'));
  events.focusout({relatedTarget: null});
  assert.ok(!classes.has('postcard-editing'));
});
