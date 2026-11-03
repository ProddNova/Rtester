const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup() {
  const source = fs.readFileSync(require.resolve('../public/js/app'), 'utf8');
  const events = {}, indicator = {}, calls = [];
  let active = true, resolve;
  const context = {
    window: { scrollY: 0, addEventListener: (name, fn) => { events[name] = fn; } },
    document: { body: { appendChild() {} }, addEventListener: (name, fn) => { events[name] = fn; } },
    h: () => indicator, $: () => ({ classList: { contains: () => active } }),
    feed: { loading: false },
    loadFeed: (mode) => { calls.push(mode); return new Promise((r) => { resolve = r; }); }
  };
  vm.runInNewContext(source.slice(source.indexOf('  function initPullRefresh()'), source.indexOf('  function init()')) + '\ninitPullRefresh();', context);
  function emit(name, x = 100, y = 0, extra = {}) {
    const e = Object.assign({ touches: [{ clientX: x, clientY: y }], target: { closest: () => false }, cancelable: true, preventDefault() { this.prevented = true; } }, extra);
    events[name](e); return e;
  }
  return { context, calls, indicator, emit, leave: () => { active = false; }, finish: async () => { resolve(); await new Promise(setImmediate); } };
}

test('pull: threshold, native gesture cancellation, one shuffle until completion', async () => {
  const s = setup();
  s.emit('touchstart'); s.emit('touchmove', 100, 50); s.emit('touchend');
  assert.equal(s.calls.length, 0);
  s.emit('touchstart');
  assert.equal(s.emit('touchmove', 100, 100).prevented, true);
  s.emit('touchend');
  assert.deepEqual(s.calls, ['shuffle']);
  s.emit('touchstart'); s.emit('touchmove', 100, 100); s.emit('touchend');
  assert.equal(s.calls.length, 1);
  await s.finish();
  assert.equal(s.indicator.hidden, true);
  s.emit('touchstart'); s.emit('touchmove', 100, 90); s.emit('touchend');
  assert.equal(s.calls.length, 2);
  await s.finish();
});

test('pull: ignores horizontal, cancelled, multitouch, scrolled and non-home gestures', () => {
  for (const kind of ['horizontal', 'cancel', 'multitouch', 'scroll', 'route', 'control', 'loading']) {
    const s = setup();
    if (kind === 'scroll') s.context.window.scrollY = 100;
    if (kind === 'loading') s.context.feed.loading = true;
    s.emit('touchstart', 100, 0, kind === 'control' ? { target: { closest: () => true } } : {});
    if (kind === 'route') s.leave();
    s.emit('touchmove', kind === 'horizontal' ? 300 : 100, 100, kind === 'multitouch' ? { touches: [{ clientX: 100, clientY: 100 }, {}] } : {});
    if (kind === 'cancel') s.emit('touchcancel');
    s.emit('touchend');
    assert.equal(s.calls.length, 0, kind);
  }
});
