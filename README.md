# Aymora Weekly Match Engine

A working prototype of the system behind Aymora's core promise: **at least one meaningful match every week, with no quality compromise.**

Built by Kanak Tanwar for the Aymora Tech Challenge. Independent prototype, not affiliated with Aymora. Every person in the demo pool is generated.

**Live demo:** `<add your Vercel URL here>`

---

## What I built

Aymora's site describes three steps: a short questionnaire, AI that understands you, and an introduction when it's mutual. This prototype builds the engine that connects those steps:

1. **A thoughtful questionnaire** (13 questions) covering intentions, children, values, personality, conflict style, how you show care, lifestyle, dealbreakers, and a free-text "perfect Sunday".
2. **An explainable compatibility score.** Hard requirements filter first and are never traded off. Eight weighted dimensions then produce a 0–100 score.
3. **A weekly matching engine** that pairs the *whole pool at once*, so everyone with a good option gets exactly one introduction per week.
4. **Introductions people can trust:** three reasons you fit, one honest difference worth talking about, and a first question drawn from both people's answers. Photos open only after a mutual yes.
5. **A feedback loop.** When someone passes and says why, their weights change for next week.
6. **An "Under the hood" simulation** comparing a swipe feed, a "best pairs first" approach, and the engine on the same pool, live in the browser.

## Why this

"One guaranteed match every week" is a hard promise to keep. If each person simply gets their top-scoring match, the same well-rounded people sit at the top of many lists, and people whose only good option was taken get nothing. That breaks the promise, or forces Aymora to lower the bar, which breaks the "no quality compromise" promise instead.

So the interesting problem is **global weekly assignment**, not ranking. On a 300-person synthetic pool:

| | Swipe feed | Best pairs first | Aymora engine |
|---|---|---|---|
| People with a match or intro | 46% | 77% | **85%** |
| Matches clearing the quality bar | 8% | 100% | **100%** |
| Average compatibility | 15 | 82 | **79** |

The engine gives up about 3 points of average score to introduce 26 more people, and every introduction still clears the bar. Everyone it leaves out either had nobody above the bar or was on the over-supplied side of the pool. By week 2 every person with any good option has had an introduction, because people who waited go first.

A product insight from this: past a point, the limit is **supply balance, not the algorithm**. That makes the gender field on Aymora's waitlist important. Early-access waves can be released by city and gender balance so the weekly promise stays true at launch.

## How it works

```
questionnaire ─► profile ─► hard gates ─► weighted score ─► weekly matching ─► introduction ─► mutual yes
                                                                 ▲                                   │
                                                                 └──── feedback adjusts weights ◄────┘
```

**Hard gates** (`engine.js › gate`): gender preference both ways, age gap ≤ 6, compatible intentions (marriage soon never meets "still exploring"), children, personal dealbreakers (smoking, drinking, non-veg, long distance), and distance when neither person would move.

**Score** (`compatibility`): eight dimensions scored 0–1 and weighted. Values and social energy reward similarity. Planning allows a small healthy difference. Conflict styles use a matrix, because two people who avoid conflict rarely resolve anything. Introductions need 72+.

| Dimension | Weight |
|---|---|
| Values (family, career, tradition) | 24% |
| What you want | 18% |
| Personality | 16% |
| Handling conflict | 10% |
| Lifestyle | 10% |
| Shared interests | 10% |
| Children | 7% |
| Showing care | 5% |

**Weekly matching** (`weeklyMatch`):
1. Build a graph with an edge for every pair that passes the gates, clears the bar, and hasn't met before.
2. Constrained-first greedy: people who waited last week go first, then people with the fewest options, each taking their best free option.
3. Augmenting pass: for anyone left out, search for a chain of re-pairings that frees up a partner.
4. Swap pass: for any two pairs, switch partners if the total score rises.
5. Anyone still unmatched gets priority next week.

**Explanations** (`explain`): reasons come from the strongest-contributing dimensions; the "worth talking about" note comes from the largest honest gap; the first question comes from shared Sunday interests.

## Run it

No build step and no dependencies. Open `index.html` in a browser, or:

```bash
npm start          # serves the folder locally
npm test           # 8 tests on the engine (Node 18+)
npm run build      # writes aymora-weekly-match.html, a single offline file
```

Deploy: push to GitHub, import the repo in Vercel, framework "Other", no build command, output directory `.`.

## Project structure

```
index.html                  page structure
styles.css                  design (light and dark)
engine.js                   gates, scoring, explanations, weekly matching
pool.js                     seeded synthetic people
simulate.js                 strategy comparison and multi-week simulation
app.js                      UI
engine.test.js              engine tests
build-single.js             bundles everything into one HTML file
aymora-weekly-match.html    single-file offline build of the demo
```

## Limits and what I'd build next

- Weights are hand-set. With real data they'd be learned from which introductions become mutual matches and second dates.
- Free text is read with keywords. A language model could read values and tone from open answers and write introductions in Aymora's voice.
- The matching is a fast heuristic rather than exact maximum-weight matching. It's tested to be maximal (no two free people who could be paired are left out); an exact solver could replace it at scale.
- Verification and safety checks would gate entry to the weekly pool.
