# Choosing a Dispatcher

A **dispatcher** is the algorithm that decides which treatment each group of participants gets routed to. Stagebook ships four:

| Dispatcher | What you provide | What it guarantees | When to reach for it |
|---|---|---|---|
| `uniform-random` | nothing | Each group's treatment is an independent uniform draw | Quick prototypes; you have no balance claim to make in a methods section |
| `weighted-random` | one weight per treatment | Each group's treatment is an independent draw with `P(T) ∝ weight(T)` | You want unequal long-run rates (e.g. 80/10/10) but don't need exact-N targets |
| `urn` | target counts per treatment (+ optional decrement matrix) | Each treatment is used exactly its target count over the batch | You want exact target Ns or cross-treatment locality (e.g. "don't pick the same label twice in a row") |
| `local-penalization` | acquisition values + penalization matrix | One batch step of an iterated Bayesian-optimization loop | You're running a researcher-managed BO surrogate between batches |

The first three are stateless or carry only a small piece of state (urn's remaining counts). All four pre-compute eligibility from each participant's data; the algorithm itself sees only IDs, treatment structure, and a boolean eligibility lookup — never the underlying responses.

## `weighted-random` in detail

This is the dispatcher most ordinary randomized experiments want when the allocation isn't 50/50. You specify weights up to scale:

```yaml
dispatcher:
  type: weighted-random
  weights: [4, 1, 1]   # T0 four times as often as T1 or T2 long-run
```

The weights are interpreted up to scale — `[4, 1, 1]`, `[80, 20, 20]`, and `[0.67, 0.17, 0.17]` are all the same sampler. Each round, the dispatcher draws a treatment with probability proportional to its weight, independently of every other round. There is no memory of which treatment was picked last; in particular, a run of three consecutive `T0` draws is not "balanced out" by extra `T1`/`T2` draws afterward.

A zero weight means "never pick this treatment." This is useful when you want to keep a condition in the file but turn it off for a particular batch without renumbering everything.

## Realized vs. target rates under eligibility constraints

The most common gotcha with `weighted-random` (and with `urn`, for the same underlying reason) is that the realized rates only match your target weights when **every round is feasible for every treatment**. Two things can break feasibility:

1. **Tight eligibility conditions** filter the candidate pool down. If only 20% of recruits satisfy treatment T0's role condition, T0 won't see its full target rate no matter how high you set its weight — there aren't enough eligible participants to fill it.
2. **Per-tick player-pool size** can be too small for some treatments. If a treatment requires 6 players but the dispatch tick has only 4 available, that treatment is excluded from this round's pool.

When a treatment drops out of a round's pool, the weight mass is implicitly renormalized across the surviving treatments. So a 4:1:1 batch with a too-tight eligibility on T0 won't deliver 67/17/17 — it'll deliver something more like 0/50/50 conditional on the tight rounds. The dispatcher is doing what you asked at every round; the design constraint is what's biting.

### A worked example

Suppose you set:

```yaml
dispatcher:
  type: weighted-random
  weights: [4, 1, 1]
```

with three two-player treatments. T0 requires *both* slots to be moderators (`self.prompt.role equals "moderator"`); T1 and T2 have no conditions. Recruitment pulls in 100 participants of whom 20 self-report as moderators (a 20% marginal rate).

Each dispatch tick draws 6 available players. For T0 to be picked *and* fillable, the tick needs at least 2 moderators among its 6 players. Under independent arrival that's a binomial probability — ~**34%** of ticks.[^1] In the other 66%, T0 drops out of the pool, and the dispatcher renormalizes the surviving weights `[1, 1]` over T1 and T2 — so T1 and T2 each absorb half the mass T0 would have taken.

Working that out per round:

- **T0 picked & filled**: `0.34 × (4/6) = 23%`
- **T1 picked**: `0.34 × (1/6) + 0.66 × (1/2) ≈ 39%`
- **T2 picked**: `0.34 × (1/6) + 0.66 × (1/2) ≈ 39%`

Compared to the target weights:

| | Target (weights/sum) | Realized | Gap |
|---|---|---|---|
| T0 | 67% | 23% | **−44 pp** |
| T1 | 17% | 39% | +22 pp |
| T2 | 17% | 39% | +22 pp |

The dispatcher is honoring `weights: [4, 1, 1]` at every feasible round. The 44-percentage-point shortfall on T0 is a study-design issue — you've asked for more moderator-condition assignments than your recruitment can supply.

[^1]: `P(K ≥ 2 | n=6, p=0.2) = 1 − P(0) − P(1) = 1 − 0.8⁶ − 6·0.2·0.8⁵ ≈ 0.345`. The exact number depends on your tick size and your moderator marginal rate; the qualitative point — that tight eligibility on a high-weight treatment causes its realized rate to fall well below its weight — holds across this whole regime.

### What to do about it

Three options, in increasing order of effort:

1. **Recruit until the rates match.** If your downstream analysis doesn't depend on exact N per cell, just let the batch run longer. Realized rates converge to weights *conditional on feasibility*; the slope is whatever your recruitment pipeline delivers.
2. **Loosen eligibility on the constrained treatment** if the condition is over-specified for what you actually need. The most common case: a condition that *could* be evaluated post-hoc as a covariate instead of gated upstream.
3. **Use `urn` instead** if you need *exact* target Ns per treatment. `urn` keeps allocating to a treatment until its target count is drained, so it will sit on a tight-eligibility condition until enough qualifying participants arrive. That comes with the tradeoff that other treatments stop receiving allocations once they hit their targets, even if more participants arrive.

### Diagnostics

The host (deliberation-lab in our deployment) gets the assignments back after every dispatch tick and can compute realized rates directly. If you're partway through a batch and the realized rate looks off relative to your target weights, the most likely cause is one of the two feasibility issues above. Check what fraction of your participants satisfy the constrained treatment's conditions; that fraction is roughly the ceiling on its realized rate.
