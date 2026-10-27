/* UI for the prototype. All matching logic lives in engine.js. */
(function () {
  const A = window.Aymora;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x) => Math.round(x * 100) + '%';

  const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Mangaluru', 'Chennai'];
  const GENDERS = [['male', 'Man'], ['female', 'Woman'], ['nonbinary', 'Non-binary']];
  const LABEL = {
    intent: { marriage: 'Marriage in 2–3 years', long_term: 'Long-term, no timeline', exploring: 'Still working it out' },
    kids: { yes: 'Wants children', open: 'Open on children', no: "Doesn't want children" },
    conflict: { talk: 'Talks things out right away', time: 'Takes time, then talks', letgo: 'Lets things go' },
    care: { words: 'Shows care in words', time: 'Shows care with time', acts: 'Shows care by doing', gifts: 'Shows care with small gifts', touch: 'Shows care through closeness' },
    diet: { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-vegetarian' },
    habits: { none: "Doesn't drink or smoke", drinks: 'Drinks socially', smokes: 'Smokes' },
  };
  const PART_LABEL = { intent: 'What you want', kids: 'Children', values: 'Values', personality: 'Personality', conflict: 'Handling conflict', care: 'Showing care', lifestyle: 'Lifestyle', interests: 'Shared interests' };

  const STEPS = [
    { id: 'basics', type: 'basics', q: 'First, the basics.' },
    { id: 'intent', type: 'choice', q: 'What are you hoping Aymora helps you find?', options: [['marriage', 'A partner to marry in the next 2–3 years'], ['long_term', 'Something long-term, no fixed timeline'], ['exploring', "I'm still working out what I want"]] },
    { id: 'kids', type: 'choice', q: 'Do you see children in your future?', options: [['yes', 'Yes'], ['open', "I'm open either way"], ['no', 'No']] },
    { id: 'family', type: 'scale', path: ['values', 'family'], q: 'When a big decision comes up, how much does your family weigh in?', lo: 'I decide on my own', hi: 'We decide together' },
    { id: 'ambition', type: 'scale', path: ['values', 'ambition'], q: 'Where does career sit in your life right now?', lo: 'One part of life', hi: 'The main focus' },
    { id: 'tradition', type: 'scale', path: ['values', 'tradition'], q: 'Festivals, rituals and traditions are…', lo: 'Not really my thing', hi: 'Central to who I am' },
    { id: 'social', type: 'scale', path: ['personality', 'social'], q: 'Friday night after a long week. You want…', lo: 'A quiet night in', hi: 'Big plans with friends' },
    { id: 'planning', type: 'scale', path: ['personality', 'planning'], q: 'A weekend trip together. You would rather…', lo: 'Wing it', hi: 'Plan every hour' },
    { id: 'conflict', type: 'choice', q: 'Something your partner did bothered you. You…', options: [['talk', 'Bring it up right away'], ['time', 'Take some time, then talk'], ['letgo', 'Let it go and move on']] },
    { id: 'care', type: 'choice', q: 'How do you most naturally show you care?', options: [['words', 'Saying it out loud'], ['time', 'Making time for them'], ['acts', 'Doing things for them'], ['gifts', 'Small, thoughtful gifts'], ['touch', 'Being physically close']] },
    { id: 'diet', type: 'choice', q: 'What do you eat?', options: [['veg', 'Vegetarian'], ['egg', 'Eggetarian'], ['nonveg', 'Non-vegetarian']] },
    { id: 'habits', type: 'choice', q: 'Drinking and smoking.', options: [['none', 'Neither'], ['drinks', 'I drink socially'], ['smokes', 'I smoke']] },
    { id: 'dealbreakers', type: 'multi', q: 'Any dealbreakers? Pick any that apply, or none.', options: [['smoker', 'A partner who smokes'], ['drinker', 'A partner who drinks'], ['nonveg', 'A non-vegetarian partner'], ['longdistance', 'Someone in another city']] },
    { id: 'sunday', type: 'text', q: 'Describe your perfect Sunday in a sentence.', placeholder: 'A sunrise trek, then a long breakfast and a good book.' },
  ];

  function blankUser() {
    return {
      id: 'you', name: '', age: 24, gender: 'male', interestedIn: ['female'], city: 'Bengaluru', openToMove: false,
      intent: null, kids: null, values: { family: null, ambition: null, tradition: null }, personality: { social: null, planning: null },
      conflict: null, care: null, diet: null, habits: null, dealbreakers: [], sunday: '', tags: [], weights: {},
    };
  }

  const state = {
    view: 'quiz', step: 0, user: blankUser(),
    pool: A.makePool(300, 2026), week: 1, history: new Set(), priority: {},
    intro: null, decision: null, feedbackNote: '',
  };

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  const TABS = ['try', 'engine', 'how'];
  function route() {
    const h = (location.hash || '#try').slice(1);
    const tab = TABS.includes(h) ? h : 'try';
    TABS.forEach((t) => { $('#view-' + t).hidden = t !== tab; });
    document.querySelectorAll('.tabs a').forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (tab === 'engine' && !engineRendered) runEngine();
    if (tab === 'how') renderHow();
  }
  window.addEventListener('hashchange', route);

  // ---------------------------------------------------------------------------
  // Try it: the questionnaire
  // ---------------------------------------------------------------------------
  const flow = $('#flow');
  function render() {
    if (state.view === 'quiz') renderStep();
    else if (state.view === 'profile') renderProfile();
    else if (state.view === 'intro') renderIntro();
  }

  function getVal(step) {
    const u = state.user;
    if (step.path) return u[step.path[0]][step.path[1]];
    return u[step.id];
  }
  function setVal(step, v) {
    const u = state.user;
    if (step.path) u[step.path[0]][step.path[1]] = v; else u[step.id] = v;
  }

  function renderStep() {
    const step = STEPS[state.step];
    const n = STEPS.length;
    let body = '';
    if (step.type === 'basics') {
      const u = state.user;
      body = `
        <div class="fields">
          <label class="field">Your first name<input type="text" id="f-name" value="${esc(u.name)}" placeholder="e.g. Kanak" autocomplete="given-name"></label>
          <label class="field">Age<input type="number" id="f-age" min="18" max="60" value="${u.age}"></label>
          <label class="field">I am a
            <select id="f-gender">${GENDERS.map(([v, l]) => `<option value="${v}" ${u.gender === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </label>
          <label class="field">City
            <select id="f-city">${CITIES.map((c) => `<option ${u.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </label>
          <div class="field full">Interested in
            <div class="opts" style="grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));">
              ${GENDERS.map(([v, l]) => `<label class="opt"><input type="checkbox" name="f-int" id="f-int-${v}" value="${v}" ${u.interestedIn.includes(v) ? 'checked' : ''}>${l}</label>`).join('')}
            </div>
          </div>
          <label class="opt full"><input type="checkbox" id="f-move" ${u.openToMove ? 'checked' : ''}>I'm open to moving cities for the right person</label>
        </div>`;
    } else if (step.type === 'choice' || step.type === 'multi') {
      const cur = getVal(step);
      const kind = step.type === 'multi' ? 'checkbox' : 'radio';
      body = `<div class="opts" role="${kind === 'radio' ? 'radiogroup' : 'group'}" aria-label="${esc(step.q)}">
        ${step.options.map(([v, l]) => {
          const on = kind === 'radio' ? cur === v : (cur || []).includes(v);
          return `<label class="opt"><input type="${kind}" name="opt" id="opt-${step.id}-${v}" value="${v}" ${on ? 'checked' : ''}>${esc(l)}</label>`;
        }).join('')}
      </div>`;
    } else if (step.type === 'scale') {
      const cur = getVal(step);
      body = `<div class="scale">
        <div class="scale-dots" role="radiogroup" aria-label="${esc(step.q)}">
          ${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="opt" id="opt-${step.id}-${v}" value="${v}" ${cur === v ? 'checked' : ''}>${v}</label>`).join('')}
        </div>
        <div class="scale-ends"><span>1 · ${esc(step.lo)}</span><span>5 · ${esc(step.hi)}</span></div>
      </div>`;
    } else if (step.type === 'text') {
      body = `<label class="field"><span class="muted small">We use this to suggest a first question, not to judge you.</span>
        <textarea id="f-text" placeholder="${esc(step.placeholder)}">${esc(state.user.sunday)}</textarea></label>`;
    }

    flow.innerHTML = `
      <div class="card fade">
        <div class="progress">
          <span class="mono small">${state.step + 1} / ${n}</span>
          <div class="progress-bar" aria-hidden="true"><span style="width:${((state.step + 1) / n) * 100}%"></span></div>
        </div>
        <p class="q">${esc(step.q)}</p>
        ${body}
        <p class="small" id="step-error" style="color: var(--warn)" hidden></p>
        <div class="row spread">
          <div class="row">
            ${state.step > 0 ? '<button class="btn ghost" type="button" id="back">Back</button>' : ''}
            <button class="btn" type="button" id="next">${state.step === n - 1 ? 'Build my profile' : 'Continue'}</button>
          </div>
          ${state.step === 0 ? '<button class="btn link" type="button" id="sample">Skip with a sample person</button>' : ''}
        </div>
      </div>`;

    if (step.type === 'choice' || step.type === 'scale') {
      flow.querySelectorAll('input[name="opt"]').forEach((inp) => inp.addEventListener('change', () => {
        setVal(step, step.type === 'scale' ? Number(inp.value) : inp.value);
        setTimeout(next, 180);
      }));
    }
    $('#next').addEventListener('click', next);
    const back = $('#back');
    if (back) back.addEventListener('click', () => { collect(step); state.step--; render(); });
    const sample = $('#sample');
    if (sample) sample.addEventListener('click', () => {
      state.user = JSON.parse(JSON.stringify(A.SAMPLE_USER));
      state.view = 'profile';
      render();
    });
  }

  function collect(step) {
    const u = state.user;
    if (step.type === 'basics') {
      u.name = $('#f-name').value.trim();
      u.age = Number($('#f-age').value) || u.age;
      u.gender = $('#f-gender').value;
      u.city = $('#f-city').value;
      u.interestedIn = [...flow.querySelectorAll('input[name="f-int"]:checked')].map((i) => i.value);
      u.openToMove = $('#f-move').checked;
    } else if (step.type === 'multi') {
      u[step.id] = [...flow.querySelectorAll('input[name="opt"]:checked')].map((i) => i.value);
    } else if (step.type === 'text') {
      u.sunday = $('#f-text').value.trim();
    }
  }

  function next() {
    const step = STEPS[state.step];
    collect(step);
    const err = $('#step-error');
    const u = state.user;
    let problem = '';
    if (step.type === 'basics') {
      if (!u.name) problem = 'Add a first name so your introductions can use it.';
      else if (u.age < 18) problem = 'Aymora is for people 18 and older.';
      else if (!u.interestedIn.length) problem = 'Choose at least one option under "Interested in".';
    } else if ((step.type === 'choice' || step.type === 'scale') && getVal(step) == null) {
      problem = 'Pick one option to continue.';
    } else if (step.type === 'text' && u.sunday.length < 8) {
      problem = 'Write a short sentence, even a simple one.';
    }
    if (problem) { if (err) { err.textContent = problem; err.hidden = false; } return; }

    if (state.step < STEPS.length - 1) { state.step++; render(); return; }
    u.tags = A.tagText(u.sunday);
    state.view = 'profile';
    render();
  }

  // ---------------------------------------------------------------------------
  // Profile + reach funnel
  // ---------------------------------------------------------------------------
  function pips(v) { return `<span class="pips" aria-label="${v} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</span>`; }

  function reach(u) {
    let basic = 0, gates = 0, bar = 0;
    for (const p of state.pool) {
      const g = A.gate(u, p);
      if (g !== 'preferences' && g !== 'age') basic++;
      if (!g) { gates++; if (A.compatibility(u, p).score >= A.QUALITY_BAR) bar++; }
    }
    return { total: state.pool.length, basic, gates, bar };
  }

  function renderProfile() {
    const u = state.user;
    const r = reach(u);
    const traits = [
      ['Family in decisions', u.values.family, 'Independent', 'Together'],
      ['Career focus', u.values.ambition, 'One part', 'Main focus'],
      ['Tradition', u.values.tradition, 'Relaxed', 'Central'],
      ['Social energy', u.personality.social, 'Quiet', 'Social'],
      ['Planning', u.personality.planning, 'Spontaneous', 'Planner'],
    ];
    const row = (label, n) => `<div class="funnel-row"><div class="funnel-bar"><span style="width:${Math.max(2, (n / r.total) * 100)}%"></span><em>${label}</em></div><b>${n}</b></div>`;
    flow.innerHTML = `
      <div class="card fade">
        <div class="block">
          <p class="block-label">Your compatibility profile</p>
          <h3>${esc(u.name)}, ${u.age} · ${esc(u.city)}</h3>
          <div class="chips">
            <span class="chip accent">${LABEL.intent[u.intent]}</span>
            <span class="chip">${LABEL.kids[u.kids]}</span>
            <span class="chip">${LABEL.conflict[u.conflict]}</span>
            <span class="chip">${LABEL.care[u.care]}</span>
            <span class="chip">${LABEL.diet[u.diet]}</span>
            <span class="chip">${LABEL.habits[u.habits]}</span>
            ${u.openToMove ? '<span class="chip">Open to moving</span>' : ''}
          </div>
        </div>
        <div class="trait-list">
          ${traits.map(([l, v, lo, hi]) => `<div class="trait"><span>${l}</span><div>${pips(v)}<div class="trait-ends"><span>${lo}</span><span>${hi}</span></div></div></div>`).join('')}
        </div>
        ${u.tags.length ? `<p class="small muted">From your perfect Sunday: ${u.tags.map((t) => `<span class="chip">${t}</span>`).join(' ')}</p>` : ''}
        <div class="block">
          <p class="block-label">Who you could meet in this demo pool</p>
          <div class="funnel">
            ${row('Everyone in the pool', r.total)}
            ${row('Fit your gender and age preferences', r.basic)}
            ${row('Also pass intentions, children and dealbreakers', r.gates)}
            ${row(`Also clear the quality bar (${A.QUALITY_BAR}+)`, r.bar)}
          </div>
          <p class="small muted">Only the last group can be introduced to you. Hard requirements filter people out entirely; they are never traded off against a high score elsewhere.</p>
        </div>
        <div class="row spread">
          <button class="btn" type="button" id="run">Run week ${state.week} matching</button>
          <button class="btn link" type="button" id="redo">Change my answers</button>
        </div>
      </div>`;
    $('#run').addEventListener('click', runWeek);
    $('#redo').addEventListener('click', () => { state.view = 'quiz'; state.step = 0; render(); });
  }

  // ---------------------------------------------------------------------------
  // Weekly matching + introduction
  // ---------------------------------------------------------------------------
  function runWeek() {
    const u = state.user;
    const everyone = [u, ...state.pool];
    const res = A.weeklyMatch(everyone, { history: state.history, priority: state.priority });
    const mine = res.pairs.find((p) => p.a.id === 'you' || p.b.id === 'you');
    const other = mine ? (mine.a.id === 'you' ? mine.b : mine.a) : null;

    // where does this person rank among my own options?
    let rank = null;
    if (other) {
      const scores = state.pool
        .filter((p) => !state.history.has(A.pairKey('you', p.id)))
        .map((p) => ({ p, c: A.compatibility(u, p) }))
        .filter((x) => x.c.ok && x.c.score >= A.QUALITY_BAR)
        .sort((x, y) => y.c.score - x.c.score);
      rank = scores.findIndex((x) => x.p.id === other.id) + 1;
    }

    // update carry-over for everyone
    for (const p of res.pairs) { state.priority[p.a.id] = 0; state.priority[p.b.id] = 0; state.history.add(A.pairKey(p.a.id, p.b.id)); }
    for (const p of res.unmatched) state.priority[p.id] = (state.priority[p.id] || 0) + 1;

    state.intro = {
      week: state.week, other, res, rank,
      options: res.options.you,
      compat: other ? A.compatibility(u, other) : null,
      explain: other ? A.explain(u, other) : null,
      introducedCount: res.pairs.length * 2, total: everyone.length,
    };
    state.decision = null;
    state.view = 'intro';
    render();
    flow.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderIntro() {
    const I = state.intro;
    const u = state.user;
    const weekline = `<div class="weekline"><span class="badge accent">Week ${I.week}</span><span>The engine introduced ${I.introducedCount} of ${I.total} people this week.</span></div>`;

    if (!I.other) {
      const none = I.options === 0;
      flow.innerHTML = `
        <div class="card fade">
          ${weekline}
          <h3>No introduction this week</h3>
          <p>${none
            ? `Nobody in this pool clears the quality bar for you right now${state.week > 1 ? ' who you haven\'t already been introduced to' : ''}. Aymora would rather hold your place than lower the bar.`
            : `You had ${I.options} good options, but each of them was a closer fit for someone else this week.`}</p>
          <p class="note">You move to the front of the queue next week. People who wait are matched first, so nobody waits twice in a row if they have any good option.</p>
          <div class="row"><button class="btn" type="button" id="nextweek">Run week ${state.week + 1}</button><button class="btn link" type="button" id="redo">Change my answers</button></div>
        </div>`;
      $('#nextweek').addEventListener('click', () => { state.week++; runWeek(); });
      $('#redo').addEventListener('click', () => { state.view = 'quiz'; state.step = 0; render(); });
      return;
    }

    const o = I.other;
    const c = I.compat;
    const first = o.name.split(' ')[0];
    const initials = o.name.split(' ').map((s) => s[0]).join('').slice(0, 2);
    const bd = Object.keys(PART_LABEL).map((k) => `
      <div class="bd-row"><span>${PART_LABEL[k]}</span><div class="bd-track"><span style="width:${Math.round(c.parts[k] * 100)}%"></span></div><b>${Math.round(c.weights[k] * 100)}%</b></div>`).join('');

    let action = '';
    if (!state.decision) {
      action = `<div class="row"><button class="btn" type="button" id="yes">I'd like to meet ${esc(first)}</button><button class="btn ghost" type="button" id="no">Not this time</button></div>`;
    } else if (state.decision === 'mutual') {
      action = `<div class="outcome note good fade">
        <span class="badge good">It's mutual</span>
        <p>${esc(first)} said yes too. Aymora opens a private chat for the two of you, with photos shared now that you both chose to meet.</p>
        <p class="small muted">Suggested first message: “${esc(I.explain.starter.replace(/^Ask \S+ /, 'I wanted to ask '))}”</p>
        <div class="row"><button class="btn ghost" type="button" id="nextweek">See how week ${state.week + 1} would look</button></div>
      </div>`;
    } else if (state.decision === 'notmutual') {
      action = `<div class="outcome note fade">
        <span class="badge">Not mutual this time</span>
        <p>${esc(first)} passed this week. Neither of you is told who said no, and nobody sees a rejection count.</p>
        <div class="row"><button class="btn" type="button" id="nextweek">Run week ${state.week + 1}</button></div>
      </div>`;
    } else if (state.decision === 'no') {
      const REASONS = [['stage', 'Different life stage'], ['values', 'Our values felt different'], ['vibe', "Our energy didn't match"], ['distance', 'Too far away']];
      action = `<div class="outcome note fade">
        <p><b>What felt off?</b> <span class="muted">Optional. It changes how your next introductions are weighted.</span></p>
        <div class="row" role="group" aria-label="Reason">${REASONS.map(([v, l]) => `<button class="chip-btn" type="button" data-reason="${v}" aria-pressed="false">${l}</button>`).join('')}</div>
        <p class="small" id="fb-note">${esc(state.feedbackNote)}</p>
        <div class="row"><button class="btn" type="button" id="nextweek">Run week ${state.week + 1}</button></div>
      </div>`;
    }

    flow.innerHTML = `
      <div class="card fade">
        ${weekline}
        <div class="intro-head">
          <div class="avatar" aria-hidden="true">${esc(initials)}</div>
          <div class="intro-who">
            <p class="block-label">Your introduction</p>
            <h3>${esc(o.name)}</h3>
            <p class="muted">${o.age} · ${esc(o.city)} · ${LABEL.intent[o.intent]}</p>
          </div>
          <div class="score"><b class="mono">${c.score}</b><span>compatibility</span></div>
        </div>
        <p class="photo-note">Photos appear once you both say yes. First impressions here come from who someone is.</p>
        <div class="block">
          <p class="block-label">Why we think you two fit</p>
          <ul class="reasons">${I.explain.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>
        <div class="block">
          <p class="block-label">Worth talking about</p>
          <p class="note">${esc(I.explain.difference)}</p>
        </div>
        <div class="block">
          <p class="block-label">A first question</p>
          <p class="note starter">${esc(I.explain.starter)}</p>
        </div>
        <p class="small muted">${I.rank <= 3 ? `${esc(first)} is #${I.rank} of your ${I.options} options above the bar. ` : `You had ${I.options} options above the bar this week. `}The engine pairs everyone at once, so your top score on paper may be someone else's only good option.</p>
        <details class="breakdown">
          <summary>See the full score breakdown</summary>
          <div class="bd">
            <div class="bd-row small muted"><span>Dimension</span><span>How aligned you are</span><b>Weight</b></div>
            ${bd}
            ${c.distance ? `<p class="small muted">Different cities: −${c.distance} points.</p>` : ''}
          </div>
        </details>
        ${action}
      </div>`;

    const yes = $('#yes');
    if (yes) yes.addEventListener('click', () => {
      state.decision = Math.random() < A.acceptChance(c.score) ? 'mutual' : 'notmutual';
      renderIntro();
    });
    const no = $('#no');
    if (no) no.addEventListener('click', () => { state.decision = 'no'; state.feedbackNote = ''; renderIntro(); });
    flow.querySelectorAll('[data-reason]').forEach((b) => b.addEventListener('click', () => applyFeedback(b)));
    const nw = $('#nextweek');
    if (nw) nw.addEventListener('click', () => { state.week++; runWeek(); });
  }

  function applyFeedback(btn) {
    const u = state.user;
    const reason = btn.dataset.reason;
    const bump = (k, f) => { u.weights[k] = Math.min(2.5, (u.weights[k] || 1) * f); };
    let note = '';
    if (reason === 'stage') { bump('intent', 1.4); bump('kids', 1.3); note = 'Next week, what you want and plans for children count 40% more in your matches.'; }
    if (reason === 'values') { bump('values', 1.4); note = 'Next week, values count 40% more in your matches.'; }
    if (reason === 'vibe') { bump('personality', 1.4); bump('interests', 1.2); note = 'Next week, personality and shared interests count more in your matches.'; }
    if (reason === 'distance') { u.distanceCare = Math.min(4, (u.distanceCare || 1) * 2); note = 'Next week, people in other cities need a much stronger fit to be introduced.'; }
    flow.querySelectorAll('[data-reason]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    state.feedbackNote = note;
    $('#fb-note').textContent = note;
  }

  // ---------------------------------------------------------------------------
  // Under the hood
  // ---------------------------------------------------------------------------
  let engineRendered = false;
  let seed = 2026;
  $('#pool-size').addEventListener('change', runEngine);
  $('#new-pool').addEventListener('click', () => { seed = Math.floor(Math.random() * 1e6); runEngine(); });

  function runEngine() {
    engineRendered = true;
    const out = $('#engine-out');
    out.innerHTML = '<p class="muted">Running the simulation…</p>';
    setTimeout(() => {
      const size = Number($('#pool-size').value);
      const users = A.makePool(size, seed);
      const t0 = performance.now();
      const cmp = A.compareAll(users);
      const wk = A.weeks(users, 4, seed + 1);
      const ms = Math.round(performance.now() - t0);
      $('#sim-meta').textContent = `pool #${seed} · ${size} people · computed in ${ms} ms`;
      renderEngine(out, users, cmp, wk);
    }, 30);
  }

  function renderEngine(out, users, cmp, wk) {
    const { swipe, greedy, engine } = cmp;
    const res = engine.result;
    const noOption = res.unmatched.filter((u) => res.options[u.id] === 0);
    const outnumbered = res.unmatched.filter((u) => res.options[u.id] > 0);
    const og = countBy(outnumbered, (u) => u.gender);
    const reachG = countBy(users.filter((u) => res.options[u.id] > 0), (u) => u.gender);
    const unmatchedReach = Object.keys(reachG).filter((g) => og[g]).map((g) => `${og[g]} ${g === 'male' ? (og[g] === 1 ? 'man' : 'men') : g === 'female' ? (og[g] === 1 ? 'woman' : 'women') : (og[g] === 1 ? 'non-binary person' : 'non-binary people')}`).join(', ');

    const bars = [
      ['Swipe feed', swipe.coverage, false],
      ['Best pairs first', greedy.coverage, false],
      ['Aymora weekly engine', engine.coverage, true],
      ['Have at least one good option', cmp.ceiling, false],
    ];

    out.innerHTML = `
      <div class="panel">
        <h3>This week, one pool, three strategies</h3>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th class="num">Swipe feed</th><th class="num">Best pairs first</th><th class="num ours">Aymora engine</th></tr></thead>
          <tbody>
            <tr><th>People with a match or introduction<span class="why">Out of everyone in the pool</span></th><td class="num">${pct(swipe.coverage)}</td><td class="num">${pct(greedy.coverage)}</td><td class="num ours"><b>${pct(engine.coverage)}</b></td></tr>
            <tr><th>Matches that clear the quality bar<span class="why">Pass every hard requirement and score ${A.QUALITY_BAR}+</span></th><td class="num">${pct(swipe.goodShare)}</td><td class="num">100%</td><td class="num ours"><b>100%</b></td></tr>
            <tr><th>Average compatibility of matches<span class="why">Blocked pairs count as 0</span></th><td class="num">${Math.round(swipe.avgScore)}</td><td class="num">${Math.round(greedy.avgScore)}</td><td class="num ours"><b>${Math.round(engine.avgScore)}</b></td></tr>
            <tr><th>Likes going to the top 10% of profiles<span class="why">How concentrated attention is</span></th><td class="num">${pct(swipe.topShare)}</td><td class="num">n/a</td><td class="num ours">n/a</td></tr>
          </tbody>
        </table></div>
        <p class="small muted">Swipe feed: each person sees 40 random profiles and likes mostly by photo appeal. Best pairs first: take the highest-scoring pairs and work down. Aymora engine: constrained people first, then re-pair to fit more people in, then swap pairs to raise total quality.</p>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3>Who got someone this week</h3>
          <div class="hbars">
            ${bars.map(([l, v, ours]) => `<div class="hbar ${ours ? 'ours' : ''}"><div class="hbar-top"><span>${l}</span><b>${pct(v)}</b></div><div class="hbar-track"><span style="width:${v * 100}%"></span></div></div>`).join('')}
          </div>
          <p class="callout small">${greedy.avgScore > engine.avgScore
            ? `Best pairs first gives a slightly higher average score, but it strands people whose only good option was taken by someone with plenty of options. The engine gives up ${(greedy.avgScore - engine.avgScore).toFixed(1)} points of average score to introduce ${Math.round((engine.coverage - greedy.coverage) * users.length)} more people, and every one of them still clears the bar.`
            : `The engine introduces ${Math.round((engine.coverage - greedy.coverage) * users.length)} more people than best pairs first without lowering the average score.`}</p>
        </div>
        <div class="panel">
          <h3>Why ${res.unmatched.length} people got nobody</h3>
          <ul class="plain">
            <li><b>${noOption.length}</b> had no one above the quality bar. Their preferences and dealbreakers are strict for a pool this size. Lowering the bar would break the "no quality compromise" promise, so they wait.</li>
            <li><b>${outnumbered.length}</b> had good options, but all of them were introduced to someone. ${unmatchedReach ? `These are ${unmatchedReach}: the pool has more of them than people looking for them.` : ''}</li>
          </ul>
          <p class="callout small">Of the people who had at least one good option, the engine introduced ${pct(engine.coverage / cmp.ceiling)}. Everyone it left out had all of their options already introduced to someone, with no chain of re-pairings that could free one up. Past that point the limit is supply, not the algorithm. That is why the gender question on Aymora's waitlist matters: early-access waves can be released by city and gender balance so the weekly promise stays true.</p>
        </div>
      </div>

      <div class="panel">
        <h3>Four weeks in a row</h3>
        <p class="small muted">No one is introduced to the same person twice. Anyone left out goes first the next week. Each side says yes with a probability that rises with the score.</p>
        ${weekChart(wk)}
        <div class="legend">
          <span><i style="background: var(--accent)"></i>Had at least one introduction so far</span>
          <span><i style="background: var(--good)"></i>Had at least one mutual match so far</span>
          <span><i style="background: var(--series-2)"></i>Introduced that week</span>
        </div>
        <p class="callout small">By week 2, ${pct(wk[1].everIntro)} of people have had an introduction${Math.abs(wk[1].everIntro - cmp.ceiling) < 0.005 ? ', which is everyone who has any good option' : ''}. Within four weeks, ${pct(wk[3].everMutual)} have had a mutual match.</p>
      </div>

      <div class="panel">
        <h3>Assumptions behind these numbers</h3>
        <ul class="plain small muted">
          <li>The pool is generated: city mix weighted to large Indian metros, a 48/48/4 gender split, about 35% of people looking for marriage soon, and a skewed "photo appeal" that only the swipe baseline uses.</li>
          <li>Compatibility uses the same scoring the Try it tab uses. In a real launch the weights would be learned from which introductions turn into mutual matches and second dates.</li>
          <li>Acceptance probabilities are illustrative. Treat the four-week figures as the shape of the result, not a forecast.</li>
        </ul>
      </div>`;
  }

  function weekChart(wk) {
    const W = 640, H = 240, L = 44, R = 56, T = 16, B = 34;
    const x = (i) => L + (i * (W - L - R)) / (wk.length - 1);
    const y = (v) => T + (1 - v) * (H - T - B);
    const series = [['coverage', 'var(--series-2)'], ['everMutual', 'var(--good)'], ['everIntro', 'var(--accent)']];
    // end labels sit right of the last point, nudged apart so they never overlap
    const ends = series.map(([k, c]) => ({ k, c, v: wk[wk.length - 1][k], y: y(wk[wk.length - 1][k]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    const line = (key, color) => {
      const pts = wk.map((w, i) => `${x(i).toFixed(1)},${y(w[key]).toFixed(1)}`).join(' ');
      const dots = wk.map((w, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(w[key]).toFixed(1)}" r="4" fill="${color}"/>`).join('');
      const e = ends.find((d) => d.k === key);
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}<text x="${x(wk.length - 1) + 10}" y="${(e.y + 4).toFixed(1)}" font-size="12" fill="${color}" font-family="var(--mono)">${pct(e.v)}</text>`;
    };
    const grid = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${v * 100}%</text>`).join('');
    const xl = wk.map((w, i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--body)">Week ${w.week}</text>`).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of people introduced and matched over four weeks">${grid}${xl}${line('coverage', 'var(--series-2)')}${line('everMutual', 'var(--good)')}${line('everIntro', 'var(--accent)')}</svg></div>`;
  }

  function countBy(xs, f) { const o = {}; for (const x of xs) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; }

  // ---------------------------------------------------------------------------
  // How it works
  // ---------------------------------------------------------------------------
  let howRendered = false;
  function renderHow() {
    if (howRendered) return;
    howRendered = true;
    const w = A.BASE_WEIGHTS;
    $('#how-out').innerHTML = `
      <div class="panel">
        <ol class="steps">
          <li><div><h3>A short questionnaire</h3><p>Thirteen questions about intentions, children, values, personality, conflict, care, lifestyle and a free-text perfect Sunday. Each answer maps to a structured trait, so nothing depends on photos.</p></div></li>
          <li><div><h3>Hard requirements first</h3><p>Gender preference, an age gap of ${A.MAX_AGE_GAP} years or less, compatible intentions (marriage soon and "still exploring" never meet), children, personal dealbreakers, and distance when neither person would move. A pair that fails any of these is never introduced, whatever else they share.</p></div></li>
          <li><div><h3>An explainable compatibility score</h3><p>Eight dimensions, each scored 0 to 1 and weighted. Some reward similarity (values, social energy), some allow healthy difference (a planner with a semi-planner), and conflict styles use a matrix because two avoiders rarely resolve anything. Only pairs scoring ${A.QUALITY_BAR}+ can be introduced.</p></div></li>
          <li><div><h3>Weekly matching for the whole pool</h3><p>People who waited last week go first, then people with the fewest good options. Each takes their best free option. A second pass looks for chains of re-pairings that fit in anyone left out, and a third swaps pairs whenever that raises the total score.</p></div></li>
          <li><div><h3>An introduction a person can trust</h3><p>Three reasons drawn from the strongest parts of the score, one honest difference worth talking about, and a first question from both people's answers. Photos and chat open only when both say yes.</p></div></li>
          <li><div><h3>Feedback that changes next week</h3><p>When someone passes and says why, their personal weights shift. "Different life stage" makes intentions count more for them next week; "too far away" makes distance cost more.</p></div></li>
        </ol>
      </div>
      <div class="grid-2">
        <div class="panel">
          <h3>Starting weights</h3>
          <div class="bd">${Object.keys(w).map((k) => `<div class="bd-row"><span>${PART_LABEL[k]}</span><div class="bd-track"><span style="width:${(w[k] / 0.24) * 100}%"></span></div><b>${Math.round(w[k] * 100)}%</b></div>`).join('')}</div>
          <p class="small muted">Hand-set for the prototype. With real outcomes these become learned per city and per intention.</p>
        </div>
        <div class="panel">
          <h3>What I'd build next</h3>
          <ul class="plain">
            <li>Use a language model to read free-text answers for values and tone, not just keywords, and to write the introduction in Aymora's voice.</li>
            <li>Learn the weights from which introductions become mutual matches and second dates.</li>
            <li>Release waitlist waves by city and gender balance so every active member can get a weekly introduction.</li>
            <li>Verification and safety checks before anyone enters the weekly pool.</li>
          </ul>
        </div>
      </div>`;
  }

  render();
  route();
})();
