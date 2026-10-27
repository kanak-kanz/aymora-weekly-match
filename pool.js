/*
 * Synthetic people for the demo. Deterministic (seeded), so every run of the
 * demo and the tests sees the same pool. None of these people are real.
 */
(function (root) {
  const A = (root.Aymora = root.Aymora || {});

  function rng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FEMALE = ['Ananya', 'Diya', 'Ira', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Saanvi', 'Tara', 'Aditi', 'Ishita', 'Lavanya', 'Pooja', 'Sneha', 'Shreya', 'Zoya', 'Fatima', 'Neha', 'Anjali', 'Rhea', 'Mehak', 'Divya', 'Swati', 'Aarohi', 'Nandini', 'Trisha', 'Sana', 'Keerthi', 'Pallavi'];
  const MALE = ['Aarav', 'Arjun', 'Dev', 'Ishaan', 'Kabir', 'Karan', 'Nikhil', 'Rahul', 'Rohan', 'Siddharth', 'Varun', 'Vihaan', 'Aditya', 'Akash', 'Harsh', 'Manav', 'Omkar', 'Pranav', 'Rishi', 'Sameer', 'Tanmay', 'Yash', 'Zaid', 'Imran', 'Abhishek', 'Kunal', 'Neeraj', 'Pratik', 'Shreyas', 'Vikram'];
  const NB = ['Ari', 'Kiran', 'Noor', 'Sasha', 'Rumi', 'Jaya'];
  const SURNAMES = ['Shetty', 'Rao', 'Iyer', 'Nair', 'Kulkarni', 'Sharma', 'Verma', 'Gupta', 'Mehta', 'Patel', 'Reddy', 'Pai', 'Kamath', 'Menon', 'Das', 'Banerjee', 'Khan', 'Fernandes', "D'Souza", 'Joshi', 'Bhat', 'Singh', 'Malhotra', 'Chopra', 'Hegde'];

  const CITIES = [['Bengaluru', 0.3], ['Mumbai', 0.18], ['Delhi', 0.14], ['Pune', 0.12], ['Hyderabad', 0.12], ['Mangaluru', 0.07], ['Chennai', 0.07]];

  // perfect-Sunday sentences, tagged with what they mention
  const SUNDAYS = [
    ['Filter coffee, the newspaper, and a long nap after lunch.', ['coffee', 'sleep']],
    ['A sunrise trek, then dosa somewhere on the way back.', ['trek', 'food']],
    ['Cooking a big lunch for friends and arguing about cricket.', ['cooking', 'friends', 'cricket']],
    ['Bookshop crawl and a quiet café corner.', ['books', 'coffee']],
    ['Beach in the evening, nothing planned before that.', ['beach', 'sleep']],
    ['Lunch at home with family, then a movie.', ['family', 'movies']],
    ['Gym in the morning, brunch, then gaming with friends.', ['gym', 'gaming', 'friends']],
    ['Painting on the balcony with music on.', ['art', 'music']],
    ['Temple visit with my parents and a long walk after.', ['temple', 'family']],
    ['Watching the match with friends and too much biryani.', ['cricket', 'friends', 'food']],
    ['Sleeping in, then a new restaurant I have been meaning to try.', ['sleep', 'food']],
    ['Reading in the park until it gets dark.', ['books']],
    ['A drive to the coast with a playlist I made for it.', ['beach', 'music']],
    ['Trying a new recipe and failing at it happily.', ['cooking']],
    ['Board games and chai with old friends.', ['friends', 'gaming']],
    ['A film marathon with snacks and zero guilt.', ['movies']],
    ['A slow morning, a long run, and a good book.', ['gym', 'books']],
    ['Live music somewhere small and loud.', ['music', 'friends']],
  ];

  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  function weighted(r, pairs) {
    let x = r(), acc = 0;
    for (const [v, p] of pairs) { acc += p; if (x <= acc) return v; }
    return pairs[pairs.length - 1][0];
  }
  const likert = (r, bias) => Math.max(1, Math.min(5, Math.round(3 + bias + (r() - 0.5) * 3.2)));

  function makePerson(r, i) {
    const gender = weighted(r, [['male', 0.48], ['female', 0.48], ['nonbinary', 0.04]]);
    const first = gender === 'male' ? pick(r, MALE) : gender === 'female' ? pick(r, FEMALE) : pick(r, NB);
    let interestedIn;
    if (gender === 'nonbinary') interestedIn = ['male', 'female', 'nonbinary'];
    else {
      const other = gender === 'male' ? 'female' : 'male';
      interestedIn = weighted(r, [[[other], 0.9], [[gender], 0.05], [['male', 'female', 'nonbinary'], 0.05]]);
    }

    const intent = weighted(r, [['marriage', 0.35], ['long_term', 0.45], ['exploring', 0.2]]);
    const traditional = intent === 'marriage' ? 0.5 : intent === 'exploring' ? -0.4 : 0;

    const habits = weighted(r, [['none', 0.5], ['drinks', 0.4], ['smokes', 0.1]]);
    const diet = weighted(r, [['veg', 0.35], ['egg', 0.1], ['nonveg', 0.55]]);
    const dealbreakers = [];
    if (habits !== 'smokes' && r() < 0.45) dealbreakers.push('smoker');
    if (habits === 'none' && r() < 0.2) dealbreakers.push('drinker');
    if (diet === 'veg' && r() < 0.3) dealbreakers.push('nonveg');
    if (r() < 0.15) dealbreakers.push('longdistance');

    const [sunday, tags] = pick(r, SUNDAYS);
    return {
      id: 'p' + String(i).padStart(4, '0'),
      name: first + ' ' + pick(r, SURNAMES),
      age: 22 + Math.floor(r() * 12),
      gender,
      interestedIn,
      city: weighted(r, CITIES),
      openToMove: r() < 0.35,
      intent,
      kids: intent === 'exploring' ? weighted(r, [['open', 0.6], ['yes', 0.2], ['no', 0.2]]) : weighted(r, [['yes', 0.6], ['open', 0.28], ['no', 0.12]]),
      values: { family: likert(r, traditional), ambition: likert(r, 0), tradition: likert(r, traditional) },
      personality: { social: likert(r, 0), planning: likert(r, 0) },
      conflict: weighted(r, [['talk', 0.4], ['time', 0.45], ['letgo', 0.15]]),
      care: weighted(r, [['time', 0.3], ['acts', 0.25], ['words', 0.2], ['touch', 0.15], ['gifts', 0.1]]),
      diet,
      habits,
      dealbreakers,
      sunday,
      tags,
      // How "swipeable" a profile photo is. Skewed: a few profiles have most of it.
      // Aymora's engine never reads this. Only the swipe-feed baseline does.
      appeal: Math.pow(r(), 2.2),
      weights: {},
    };
  }

  function makePool(size, seed) {
    const r = rng(seed == null ? 2026 : seed);
    return Array.from({ length: size }, (_, i) => makePerson(r, i + 1));
  }

  // A filled-in sample for "Use a sample person" in the demo.
  const SAMPLE_USER = {
    id: 'you',
    name: 'Kanak',
    age: 23,
    gender: 'male',
    interestedIn: ['female'],
    city: 'Mangaluru',
    openToMove: true,
    intent: 'long_term',
    kids: 'open',
    values: { family: 3, ambition: 4, tradition: 3 },
    personality: { social: 2, planning: 4 },
    conflict: 'talk',
    care: 'time',
    diet: 'nonveg',
    habits: 'none',
    dealbreakers: ['smoker'],
    sunday: 'A sunrise trek, then a long breakfast and a good book.',
    tags: ['trek', 'food', 'books'],
    weights: {},
  };

  Object.assign(A, { rng, makePool, SAMPLE_USER, SUNDAY_TAGS: Object.keys({ coffee: 1, books: 1, trek: 1, cricket: 1, cooking: 1, movies: 1, music: 1, beach: 1, family: 1, gym: 1, gaming: 1, art: 1, temple: 1, sleep: 1, food: 1, friends: 1 }) });
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
