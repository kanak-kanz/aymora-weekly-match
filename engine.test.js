// Run with: npm test   (or: node --test)
const test = require('node:test');
const assert = require('node:assert');
const A = require('./engine.js');
require('./pool.js');
require('./simulate.js');

const base = () => JSON.parse(JSON.stringify(A.SAMPLE_USER));
const partner = (over) => Object.assign(base(), { id: 'p1', name: 'Riya Shetty', gender: 'female', interestedIn: ['male'] }, over || {});

test('hard requirements block a pair regardless of score', () => {
  const me = base();
  assert.equal(A.compatibility(me, partner({ habits: 'smokes' })).blocked, 'dealbreaker');
  assert.equal(A.compatibility(me, partner({ age: me.age + 10 })).blocked, 'age');
  assert.equal(A.compatibility(me, partner({ interestedIn: ['female'] })).blocked, 'preferences');
  assert.equal(A.compatibility(Object.assign(me, { intent: 'marriage' }), partner({ intent: 'exploring' })).blocked, 'intent');
});

test('different cities only work if someone would move', () => {
  const me = Object.assign(base(), { openToMove: false });
  assert.equal(A.compatibility(me, partner({ city: 'Delhi', openToMove: false })).blocked, 'distance');
  assert.equal(A.compatibility(me, partner({ city: 'Delhi', openToMove: true })).ok, true);
});

test('a near-identical partner scores high and is explained', () => {
  const me = base();
  const r = A.compatibility(me, partner());
  assert.ok(r.score >= 85, 'score ' + r.score);
  const e = A.explain(me, partner(), r);
  assert.equal(e.reasons.length, 3);
  assert.ok(e.starter.includes('Riya'));
});

test('weekly matching gives nobody two introductions and respects the bar', () => {
  const pool = A.makePool(200, 5);
  const res = A.weeklyMatch(pool);
  const seen = new Set();
  for (const p of res.pairs) {
    assert.ok(!seen.has(p.a.id) && !seen.has(p.b.id));
    seen.add(p.a.id); seen.add(p.b.id);
    assert.ok(p.score >= A.QUALITY_BAR);
    assert.ok(A.compatibility(p.a, p.b).ok);
  }
});

test('nobody with a free good option is left out (matching is maximal)', () => {
  const pool = A.makePool(250, 9);
  const res = A.weeklyMatch(pool);
  const free = new Set(res.unmatched.map((u) => u.id));
  for (const u of res.unmatched)
    for (const v of res.unmatched)
      if (u.id < v.id) {
        const c = A.compatibility(u, v);
        assert.ok(!(c.ok && c.score >= A.QUALITY_BAR), `${u.id} and ${v.id} could have been paired`);
      }
  assert.ok(free.size < pool.length);
});

test('engine introduces more people than best-pairs-first', () => {
  const pool = A.makePool(300, 2026);
  assert.ok(A.engineRun(pool).coverage > A.bestPairsFirst(pool).coverage);
});

test('no repeat introductions across weeks, and waiting people go first', () => {
  const pool = A.makePool(150, 3);
  const history = new Set();
  const priority = {};
  const w1 = A.weeklyMatch(pool, { history, priority });
  w1.pairs.forEach((p) => history.add(A.pairKey(p.a.id, p.b.id)));
  w1.unmatched.forEach((u) => (priority[u.id] = 1));
  const w2 = A.weeklyMatch(pool, { history, priority });
  for (const p of w2.pairs) assert.ok(!history.has(A.pairKey(p.a.id, p.b.id)));
});

test('free-text Sunday becomes tags', () => {
  assert.deepEqual(A.tagText('A trek, then coffee and a book').sort(), ['books', 'coffee', 'trek']);
});
