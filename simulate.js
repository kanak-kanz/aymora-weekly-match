/*
 * Simulations that compare matching strategies on the same synthetic pool.
 * These are illustrations under stated assumptions, not predictions.
 */
(function (root) {
  const A = (root.Aymora = root.Aymora || {});

  // ---- Baseline 1: a swipe feed ---------------------------------------------
  // Each person is shown a random feed of profiles that fit their gender
  // preference and likes based mostly on photo appeal. A match = both liked.
  function swipeFeed(users, opts) {
    opts = opts || {};
    const r = A.rng(opts.seed || 7);
    const feedSize = opts.feedSize || 40;
    const likes = new Map(); // id -> Set of liked ids
    const inbound = new Map(users.map((u) => [u.id, 0]));
    const totalLikes = { n: 0 };

    for (const u of users) {
      const visible = users.filter((v) => v.id !== u.id && u.interestedIn.includes(v.gender) && v.interestedIn.includes(u.gender));
      const set = new Set();
      for (let k = 0; k < Math.min(feedSize, visible.length); k++) {
        const v = visible[Math.floor(r() * visible.length)];
        if (r() < 0.04 + 0.7 * v.appeal) { set.add(v.id); inbound.set(v.id, inbound.get(v.id) + 1); totalLikes.n++; }
      }
      likes.set(u.id, set);
    }

    const byId = new Map(users.map((u) => [u.id, u]));
    const matched = new Set();
    const scores = [];
    for (const u of users) {
      for (const vid of likes.get(u.id)) {
        if (u.id < vid && likes.get(vid) && likes.get(vid).has(u.id)) {
          matched.add(u.id); matched.add(vid);
          const c = A.compatibility(u, byId.get(vid));
          scores.push(c.ok ? c.score : 0);
        }
      }
    }
    const sorted = [...inbound.values()].sort((a, b) => b - a);
    const top10 = sorted.slice(0, Math.ceil(users.length * 0.1)).reduce((s, x) => s + x, 0);
    return {
      name: 'Swipe feed',
      coverage: matched.size / users.length,
      avgScore: avg(scores),
      goodShare: scores.length ? scores.filter((s) => s >= A.QUALITY_BAR).length / scores.length : 0,
      topShare: totalLikes.n ? top10 / totalLikes.n : 0,
      zeroLikes: sorted.filter((x) => x === 0).length / users.length,
    };
  }

  // ---- Baseline 2: best pairs first -----------------------------------------
  // Sort every quality pair by score and take it if both people are free.
  function bestPairsFirst(users) {
    const edges = [];
    for (let i = 0; i < users.length; i++)
      for (let j = i + 1; j < users.length; j++) {
        const c = A.compatibility(users[i], users[j]);
        if (c.ok && c.score >= A.QUALITY_BAR) edges.push([i, j, c.score]);
      }
    edges.sort((x, y) => y[2] - x[2]);
    const used = new Set();
    const scores = [];
    for (const [i, j, s] of edges) {
      if (used.has(i) || used.has(j)) continue;
      used.add(i); used.add(j); scores.push(s);
    }
    return { name: 'Best pairs first', coverage: used.size / users.length, avgScore: avg(scores), goodShare: 1, topShare: null };
  }

  // ---- Aymora weekly engine ---------------------------------------------------
  function engine(users) {
    const res = A.weeklyMatch(users);
    const scores = res.pairs.map((p) => p.score);
    return { name: 'Aymora weekly engine', coverage: (res.pairs.length * 2) / users.length, avgScore: avg(scores), goodShare: 1, topShare: null, result: res };
  }

  // People with zero quality options can't be helped by any algorithm this week.
  function ceiling(users) {
    const res = A.weeklyMatch(users);
    const reachable = Object.values(res.options).filter((x) => x > 0).length;
    return reachable / users.length;
  }

  // ---- Several weeks in a row -------------------------------------------------
  // No repeat introductions; anyone unmatched goes first next week; each side
  // says yes with a probability that rises with the score.
  function weeks(users, count, seed) {
    const r = A.rng(seed || 11);
    const history = new Set();
    const priority = {};
    const out = [];
    const everMutual = new Set();
    const everIntro = new Set();
    for (let w = 1; w <= count; w++) {
      const res = A.weeklyMatch(users, { history, priority });
      let mutual = 0;
      for (const p of res.pairs) {
        history.add(A.pairKey(p.a.id, p.b.id));
        everIntro.add(p.a.id); everIntro.add(p.b.id);
        priority[p.a.id] = 0; priority[p.b.id] = 0;
        if (r() < A.acceptChance(p.score) && r() < A.acceptChance(p.score)) { mutual++; everMutual.add(p.a.id); everMutual.add(p.b.id); }
      }
      for (const u of res.unmatched) priority[u.id] = (priority[u.id] || 0) + 1;
      out.push({
        week: w,
        coverage: (res.pairs.length * 2) / users.length,
        avgScore: avg(res.pairs.map((p) => p.score)),
        mutualRate: res.pairs.length ? mutual / res.pairs.length : 0,
        everMutual: everMutual.size / users.length,
        everIntro: everIntro.size / users.length,
      });
    }
    return out;
  }

  function avg(xs) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }

  function compareAll(users) {
    return { swipe: swipeFeed(users), greedy: bestPairsFirst(users), engine: engine(users), ceiling: ceiling(users) };
  }

  Object.assign(A, { swipeFeed, bestPairsFirst, engineRun: engine, weeks, compareAll, ceiling });
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
