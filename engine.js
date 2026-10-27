/*
 * Aymora Weekly Match Engine
 * --------------------------
 * 1. compatibility(a, b)  -> hard gates + weighted, explainable score (0-100)
 * 2. explain(a, b, result) -> "why you two", "worth talking about", conversation starter
 * 3. weeklyMatch(users)   -> one introduction per person per week, chosen globally
 *
 * Plain JavaScript, no dependencies. Works in the browser (window.Aymora)
 * and in Node (module.exports) so the same code is tested and demoed.
 */
(function (root) {
  const A = (root.Aymora = root.Aymora || {});

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  const BASE_WEIGHTS = {
    intent: 0.18,      // what each person is looking for
    kids: 0.07,        // children someday
    values: 0.24,      // family, ambition, tradition
    personality: 0.16, // social energy, planning style
    conflict: 0.10,    // how each handles disagreements
    care: 0.05,        // how each shows care
    lifestyle: 0.10,   // diet, drinking, smoking
    interests: 0.10,   // overlap in "perfect Sunday"
  };

  // "No quality compromise": an introduction must clear this bar.
  const QUALITY_BAR = 72;
  const MAX_AGE_GAP = 6;
  const LONG_DISTANCE_PENALTY = 4; // points

  const INTENT = {
    marriage: { marriage: 1, long_term: 0.6, exploring: null },
    long_term: { marriage: 0.6, long_term: 1, exploring: 0.5 },
    exploring: { marriage: null, long_term: 0.5, exploring: 0.9 },
  };
  const KIDS = {
    yes: { yes: 1, open: 0.75, no: null },
    open: { yes: 0.75, open: 0.85, no: 0.75 },
    no: { yes: null, open: 0.75, no: 1 },
  };
  const CONFLICT = {
    talk: { talk: 1, time: 0.8, letgo: 0.4 },
    time: { talk: 0.8, time: 0.9, letgo: 0.6 },
    letgo: { talk: 0.4, time: 0.6, letgo: 0.5 }, // two avoiders rarely resolve things
  };
  const DIET = {
    veg: { veg: 1, egg: 0.8, nonveg: 0.6 },
    egg: { veg: 0.8, egg: 1, nonveg: 0.8 },
    nonveg: { veg: 0.6, egg: 0.8, nonveg: 1 },
  };

  // ---------------------------------------------------------------------------
  // Hard gates: things that are never "compensated" by a high score elsewhere
  // ---------------------------------------------------------------------------
  function gate(a, b) {
    if (a.id === b.id) return 'self';
    if (!a.interestedIn.includes(b.gender) || !b.interestedIn.includes(a.gender)) return 'preferences';
    if (Math.abs(a.age - b.age) > MAX_AGE_GAP) return 'age';
    if (INTENT[a.intent][b.intent] === null) return 'intent';
    if (KIDS[a.kids][b.kids] === null) return 'kids';
    if (breaks(a, b) || breaks(b, a)) return 'dealbreaker';
    if (a.city !== b.city && !a.openToMove && !b.openToMove) return 'distance';
    return null;
  }

  // does b trip one of a's dealbreakers?
  function breaks(a, b) {
    const d = a.dealbreakers || [];
    if (d.includes('smoker') && b.habits === 'smokes') return true;
    if (d.includes('drinker') && (b.habits === 'drinks' || b.habits === 'smokes')) return true;
    if (d.includes('nonveg') && b.diet === 'nonveg') return true;
    if (d.includes('longdistance') && a.city !== b.city) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // Soft score
  // ---------------------------------------------------------------------------
  const sim5 = (x, y) => 1 - Math.abs(x - y) / 4; // similarity on a 1-5 scale

  function parts(a, b) {
    const v = ['family', 'ambition', 'tradition'];
    const values = v.reduce((s, k) => s + sim5(a.values[k], b.values[k]), 0) / v.length;

    const social = sim5(a.personality.social, b.personality.social);
    const pd = Math.abs(a.personality.planning - b.personality.planning);
    const planning = pd <= 1 ? 1 : 1 - (pd - 1) / 3; // a small difference is healthy
    const personality = 0.6 * social + 0.4 * planning;

    const habits = a.habits === b.habits ? 1 : 0.7;
    const lifestyle = 0.5 * DIET[a.diet][b.diet] + 0.5 * habits;

    const ta = new Set(a.tags || []), tb = new Set(b.tags || []);
    const shared = [...ta].filter((t) => tb.has(t));
    const union = new Set([...ta, ...tb]).size || 1;
    const interests = 0.4 + 0.6 * (shared.length / union);

    return {
      intent: INTENT[a.intent][b.intent],
      kids: KIDS[a.kids][b.kids],
      values,
      personality,
      conflict: CONFLICT[a.conflict][b.conflict],
      care: a.care === b.care ? 1 : 0.6,
      lifestyle,
      interests,
    };
  }

  // Each person can tune how much a dimension matters to them (feedback loop).
  // A pair uses the average of both people's multipliers.
  function pairWeights(a, b) {
    const w = {};
    let total = 0;
    for (const k in BASE_WEIGHTS) {
      const ma = (a.weights && a.weights[k]) || 1;
      const mb = (b.weights && b.weights[k]) || 1;
      w[k] = BASE_WEIGHTS[k] * ((ma + mb) / 2);
      total += w[k];
    }
    for (const k in w) w[k] /= total;
    return w;
  }

  function compatibility(a, b) {
    const blocked = gate(a, b);
    if (blocked) return { ok: false, blocked, score: 0 };
    const p = parts(a, b);
    const w = pairWeights(a, b);
    let raw = 0;
    for (const k in w) raw += w[k] * p[k];
    const distance = a.city !== b.city ? LONG_DISTANCE_PENALTY * Math.max(a.distanceCare || 1, b.distanceCare || 1) : 0;
    const score = Math.max(0, Math.round(raw * 100 - distance));
    return { ok: true, blocked: null, score, parts: p, weights: w, distance };
  }

  // ---------------------------------------------------------------------------
  // Explanations — written from "you" (a) to "them" (b)
  // ---------------------------------------------------------------------------
  const CARE_PHRASE = {
    words: 'saying it out loud',
    time: 'making time',
    acts: 'doing things for each other',
    gifts: 'small, thoughtful gifts',
    touch: 'being physically close',
  };
  const PLAN_WORD = (x) => (x >= 4 ? 'plans trips down to the hour' : x <= 2 ? 'would rather wing it' : 'likes a rough plan');
  const SOCIAL_WORD = (x) => (x >= 4 ? 'comes alive with a full social calendar' : x <= 2 ? 'recharges with a quiet night in' : 'likes a mix of plans and quiet');
  const AMBITION_WORD = (x) => (x >= 4 ? 'is all-in on career right now' : x <= 2 ? 'keeps work in its place' : 'balances career with everything else');
  const FAMILY_WORD = (x) => (x >= 4 ? 'decides big things together with family' : x <= 2 ? 'makes big decisions independently' : 'listens to family but decides alone');
  const TRADITION_WORD = (x) => (x >= 4 ? 'holds festivals and rituals close' : x <= 2 ? "isn't very traditional" : 'enjoys traditions without being strict');

  function reasons(a, b, r) {
    const out = [];
    const add = (strength, text) => out.push({ strength, text });
    const w = r.weights;

    if (a.intent === b.intent) {
      add(w.intent * 1.2, {
        marriage: "You're both hoping to marry in the next few years.",
        long_term: 'You both want something long-term, without a fixed timeline.',
        exploring: "You're both still working out what you want, so there's no pressure on either side.",
      }[a.intent]);
    }
    if (a.kids === b.kids && a.kids !== 'open') {
      add(w.kids * 1.5, a.kids === 'yes' ? 'You both see children in your future.' : "Neither of you wants children, and you're on the same page about it.");
    }
    const V = a.values, U = b.values;
    if (V.family >= 4 && U.family >= 4) add(w.values * 0.9, 'Family has a real say in big decisions for both of you.');
    else if (V.family <= 2 && U.family <= 2) add(w.values * 0.9, 'You both make big decisions on your own terms.');
    if (V.ambition >= 4 && U.ambition >= 4) add(w.values * 0.8, 'Career is a big focus for both of you right now.');
    else if (V.ambition <= 2 && U.ambition <= 2) add(w.values * 0.8, 'Neither of you lives for work.');
    if (V.tradition >= 4 && U.tradition >= 4) add(w.values * 0.8, 'Festivals and traditions matter to both of you.');
    else if (V.tradition <= 2 && U.tradition <= 2) add(w.values * 0.7, "You're both relaxed about rituals and traditions.");
    const S = a.personality.social, T = b.personality.social;
    if (S <= 2 && T <= 2) add(w.personality, 'You both recharge with a quiet night in.');
    else if (S >= 4 && T >= 4) add(w.personality, 'You both come alive with a full social calendar.');
    if (a.conflict === b.conflict && a.conflict !== 'letgo') {
      add(w.conflict * 1.3, a.conflict === 'talk' ? 'You both prefer to talk things out straight away.' : 'You both need a little space before a hard conversation, and you get that about each other.');
    }
    if (a.care === b.care) add(w.care * 1.6, `You show care the same way: ${CARE_PHRASE[a.care]}.`);
    const shared = (a.tags || []).filter((t) => (b.tags || []).includes(t));
    if (shared.length) add(w.interests * 1.4, `You both mentioned ${listJoin(shared.slice(0, 2))} in your perfect Sunday.`);
    if (a.diet === b.diet && a.diet === 'veg') add(w.lifestyle * 0.6, "You're both vegetarian.");

    out.sort((x, y) => y.strength - x.strength);
    return out.slice(0, 3).map((x) => x.text);
  }

  // The biggest honest difference — matchmakers mention these, apps hide them.
  function difference(a, b) {
    const name = b.name.split(' ')[0];
    const gaps = [
      { gap: Math.abs(a.personality.planning - b.personality.planning), text: `${name} ${PLAN_WORD(b.personality.planning)}, and you ${PLAN_WORD(a.personality.planning).replace('plans', 'plan').replace('likes', 'like')}.` },
      { gap: Math.abs(a.personality.social - b.personality.social), text: `${name} ${SOCIAL_WORD(b.personality.social)}; you ${SOCIAL_WORD(a.personality.social).replace('comes', 'come').replace('recharges', 'recharge').replace('likes', 'like')}.` },
      { gap: Math.abs(a.values.ambition - b.values.ambition), text: `${name} ${AMBITION_WORD(b.values.ambition)}. Worth asking what a good week looks like for each of you.` },
      { gap: Math.abs(a.values.family - b.values.family), text: `${name} ${FAMILY_WORD(b.values.family)}. Talk early about how family fits into decisions.` },
      { gap: Math.abs(a.values.tradition - b.values.tradition), text: `${name} ${TRADITION_WORD(b.values.tradition)}. Ask how they spend Diwali, Eid or Christmas.` },
    ];
    if (a.city !== b.city) gaps.push({ gap: 2.5, text: `${name} lives in ${b.city}. Talk about who would move, and when.` });
    gaps.sort((x, y) => y.gap - x.gap);
    return gaps[0].gap >= 2 ? gaps[0].text : `You're unusually aligned. The interesting part will be finding where you aren't.`;
  }

  const STARTERS = {
    coffee: 'Ask {n} where they get their coffee and whether it is worth the trip.',
    books: 'Ask {n} what they are reading right now, and whether they would recommend it.',
    trek: 'Ask {n} about the best trek they have done and the one still on their list.',
    cricket: 'Ask {n} which match they still argue about.',
    cooking: 'Ask {n} what they cook when they want to impress someone.',
    movies: 'Ask {n} which film they could rewatch every month.',
    music: 'Ask {n} what has been on repeat this week.',
    beach: "Ask {n} about their favourite stretch of coast. Gokarna or Goa is a fair first debate.",
    family: 'Ask {n} what a typical Sunday lunch at home looks like.',
    gym: 'Ask {n} whether they are a morning workout person, and how.',
    gaming: 'Ask {n} what they are playing right now.',
    art: 'Ask {n} what they have been making lately.',
    temple: 'Ask {n} which temple or quiet place they go to reset.',
    sleep: 'Ask {n} what time a perfect Sunday actually starts.',
    food: 'Ask {n} for the one place in the city you have to try.',
    friends: 'Ask {n} about the friends they spend Sundays with.',
  };

  function starter(a, b) {
    const name = b.name.split(' ')[0];
    const shared = (a.tags || []).filter((t) => (b.tags || []).includes(t));
    const tag = shared[0] || (b.tags || [])[0];
    if (tag && STARTERS[tag]) return STARTERS[tag].replace('{n}', name);
    return `Ask ${name} about their perfect Sunday. They wrote: "${b.sunday}"`;
  }

  function explain(a, b, r) {
    r = r || compatibility(a, b);
    return { reasons: reasons(a, b, r), difference: difference(a, b), starter: starter(a, b) };
  }

  function listJoin(xs) {
    return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }

  // ---------------------------------------------------------------------------
  // Weekly matching
  // ---------------------------------------------------------------------------
  // Goal: everyone with at least one option above the quality bar gets exactly
  // one introduction this week, while keeping total compatibility high.
  //
  //   1. Build the "quality graph": an edge for every pair that clears the
  //      gates and the quality bar and hasn't been introduced before.
  //   2. Constrained-first greedy: people who waited last week go first, then
  //      people with the fewest options, each taking their best free option.
  //   3. Augmenting pass: for anyone left out, try to free up a partner by
  //      re-pairing them (u-a, b-w instead of a-b). Raises coverage.
  //   4. Swap pass: for two pairs (a-b, c-d), switch to (a-c, b-d) or
  //      (a-d, b-c) if the total score goes up. Raises quality.
  //   5. Anyone still unmatched gets priority next week (carry-over).
  function weeklyMatch(users, opts) {
    opts = opts || {};
    const bar = opts.qualityBar != null ? opts.qualityBar : QUALITY_BAR;
    const history = opts.history || new Set();
    const priority = opts.priority || {};
    const n = users.length;

    const cand = Array.from({ length: n }, () => []);
    const score = new Map();
    const key = (i, j) => (i < j ? i * n + j : j * n + i);
    let feasibleEdges = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (history.has(pairKey(users[i].id, users[j].id))) continue;
        const r = compatibility(users[i], users[j]);
        if (!r.ok) continue;
        feasibleEdges++;
        if (r.score < bar) continue;
        cand[i].push(j);
        cand[j].push(i);
        score.set(key(i, j), r.score);
      }
    }
    const s = (i, j) => score.get(key(i, j));
    for (let i = 0; i < n; i++) cand[i].sort((x, y) => s(i, y) - s(i, x));

    const partner = new Int32Array(n).fill(-1);
    const order = [...Array(n).keys()].sort((x, y) =>
      (priority[users[y].id] || 0) - (priority[users[x].id] || 0) ||
      cand[x].length - cand[y].length ||
      hash(users[x].id) - hash(users[y].id)
    );

    // 2. constrained-first greedy
    for (const i of order) {
      if (partner[i] !== -1) continue;
      for (const j of cand[i]) {
        if (partner[j] === -1) { partner[i] = j; partner[j] = i; break; }
      }
    }

    // 3. augmenting pass: for anyone left out, look for a chain of re-pairings
    //    u-a, (a's partner b)-c, (c's partner d)-e ... that ends at a free
    //    person. Each successful chain adds one more introduction.
    const MAX_DEPTH = 10;
    function augment(u, seen, depth) {
      if (depth > MAX_DEPTH) return false;
      for (const a of cand[u]) {
        if (seen.has(a)) continue;
        seen.add(a);
        const b = partner[a];
        if (b === -1) { link(u, a); return true; }
        if (b === u) continue;
        seen.add(b);
        partner[b] = -1; partner[a] = -1;
        if (augment(b, seen, depth + 1)) { link(u, a); return true; }
        link(a, b); // undo
      }
      return false;
    }
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const u of order) {
        if (partner[u] !== -1 || !cand[u].length) continue;
        if (augment(u, new Set([u]), 0)) changed = true;
      }
      if (!changed) break;
    }

    // 4. swap pass
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      const pairs = currentPairs(partner);
      for (let x = 0; x < pairs.length; x++) {
        for (let y = x + 1; y < pairs.length; y++) {
          const [a, b] = pairs[x], [c, d] = pairs[y];
          if (partner[a] !== b || partner[c] !== d) continue;
          const now = s(a, b) + s(c, d);
          const o1 = s(a, c) != null && s(b, d) != null ? s(a, c) + s(b, d) : -1;
          const o2 = s(a, d) != null && s(b, c) != null ? s(a, d) + s(b, c) : -1;
          if (o1 > now && o1 >= o2) { link(a, c); link(b, d); improved = true; }
          else if (o2 > now) { link(a, d); link(b, c); improved = true; }
        }
      }
      if (!improved) break;
    }
    function link(i, j) { partner[i] = j; partner[j] = i; }

    const pairs = currentPairs(partner).map(([i, j]) => ({ a: users[i], b: users[j], score: s(i, j) }));
    const unmatched = [];
    const options = {};
    for (let i = 0; i < n; i++) {
      options[users[i].id] = cand[i].length;
      if (partner[i] === -1) unmatched.push(users[i]);
    }
    return { pairs, unmatched, options, feasibleEdges, qualityBar: bar };
  }

  function currentPairs(partner) {
    const out = [];
    for (let i = 0; i < partner.length; i++) if (partner[i] > i) out.push([i, partner[i]]);
    return out;
  }

  function pairKey(x, y) { return x < y ? x + '|' + y : y + '|' + x; }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Turn a free-text "perfect Sunday" into interest tags.
  const TAG_WORDS = {
    coffee: ['coffee', 'café', 'cafe', 'chai', 'tea'],
    books: ['book', 'read', 'novel', 'library'],
    trek: ['trek', 'hike', 'hiking', 'mountain', 'trail'],
    cricket: ['cricket', 'match', 'ipl'],
    cooking: ['cook', 'recipe', 'bake', 'baking'],
    movies: ['movie', 'film', 'cinema', 'netflix', 'series'],
    music: ['music', 'song', 'playlist', 'guitar', 'concert', 'gig'],
    beach: ['beach', 'sea', 'coast', 'ocean'],
    family: ['family', 'parents', 'mom', 'dad', 'amma', 'home'],
    gym: ['gym', 'run', 'workout', 'yoga', 'swim', 'cycle'],
    gaming: ['game', 'gaming', 'playstation', 'board game'],
    art: ['paint', 'draw', 'sketch', 'art', 'pottery', 'photograph'],
    temple: ['temple', 'church', 'mosque', 'pray', 'meditat'],
    sleep: ['sleep', 'nap', 'lazy', 'slow morning'],
    food: ['food', 'brunch', 'breakfast', 'lunch', 'biryani', 'dosa', 'restaurant', 'eat'],
    friends: ['friends', 'gang', 'squad'],
  };
  function tagText(text) {
    const t = (text || '').toLowerCase();
    return Object.keys(TAG_WORDS).filter((k) => TAG_WORDS[k].some((w) => t.includes(w)));
  }

  // Probability someone says yes to an introduction, used only in simulations.
  function acceptChance(score) { return 1 / (1 + Math.exp(-(score - 76) / 5)); }

  Object.assign(A, {
    BASE_WEIGHTS, QUALITY_BAR, MAX_AGE_GAP,
    gate, compatibility, explain, weeklyMatch, pairKey, acceptChance, hash, tagText,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
