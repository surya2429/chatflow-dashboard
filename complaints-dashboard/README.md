# Project-wise complaints summary

A standalone community-complaints dashboard. It is **not** part of the WhatsApp app in
`../src` — separate product, separate entry, separate styles. Like `../pnl-dashboard`, it
resolves its dependencies from the parent `node_modules`, so there is no install step.

```bash
npx vite --config complaints-dashboard/vite.config.js --port 5181
```

Then open <http://localhost:5181>.

## The layout

One segmented control switches the body between three views. The header and the summary
band stay put across all three.

| View | |
| --- | --- |
| **Split** (default) | The communities carrying the load as cards, everything else as a table. |
| **Cards** | All 11 as cards, still in the two groups. |
| **Table** | All 11 in rows, still in the two groups. Numeric columns sort. |

The top group is ranked on the **full** dataset, so typing in the search box filters rows
without re-shuffling which communities count as "carrying the load". `spotlightCount`
(2–6) sets how many get cards.

## What is on the page

A summary band (total logged, plus Open / In progress / Reopened / Closed), then two
analysis panels side by side — **Open complaints by bucket** and **Needs attention today**
— then the community breakdown in whichever of the three views is selected. The 1.6/1
split on the panel row lands the two panels at the same height.

The bucket panel leads with the buckets that matter. Two of them hold 61% of everything
open while the other nine are ties at 1 and 2, so a flat ranked list spent eight of its
eleven rows saying nothing. Anything holding a tenth of the total (`BUCKET_LEAD_CUT`) gets
a tile with its share of all open complaints; the rest go to a compact two-column register
where a tie stays a tie instead of being drawn as a bar that implies a difference.

The triage tiles call `onFilterSelect(key)` with one of `sla`, `unassigned`, `ageing` or
`awaiting`. They are real buttons but nothing is wired to them yet: filtering needs
ticket-level rows, and the seed data here is aggregate counts only.

## Three decisions worth knowing

**Bars share one scale across every card.** Each status gets its own labelled bar, and
all of them are measured against the largest single status count anywhere in the data. So
a long Open bar means the same thing on Elegance as on Lotus Homes, and you can compare
across cards, not just within one. A per-card stacked bar normalised each card to itself
and lost exactly that.

**Reopened never sits beside orange as a peer.** Red against orange fails the colour-blind
separation floor badly — ΔE 7.1 against a floor of 15, which is hard to read even with
full colour vision. Open, In progress and Closed are three validated hues, each clearing
both the CVD floor and 3:1 contrast on white; Reopened only gets its own labelled row when
the count is non-zero, and in the table it is a plain column.

**Severity tints the card, it does not just dot it.** Each community's band comes from its open
ratio — High load ≥ 67%, Watch ≥ 34%, Healthy below, No tickets at zero — so a community
at 100% open never wears the same colour as one at 50%. On a **card** it tints the header
band, with the band always spelling the label out beside the name. The **table** is
deliberately just the numbers, so there the dot carries its label in a tooltip and for
screen readers instead.

## Things about the source data

**The bucket totals do not reconcile either.** The eleven buckets sum to 33 open
complaints, while the summary band counts 26 open. Both figures came from the source
report unchanged.

**Three buckets are the same bucket.** "Others" (9), "Other" (1) and "Other Issue" (1)
hold 11 between them — which would tie Electricity for the largest category. Merging them
is a source-data fix, so the panel footer names the problem rather than quietly combining
the rows.

**`total` does not reconcile with the statuses.** They sum to 61 (26 open + 13 in progress
+ 0 reopened + 22 closed) while Total Logged is 48. Elegance alone is 18 logged against 23
in statuses. The seed data in `src/components/ComplaintsSummary.jsx` keeps the original
figures unchanged; status proportions are computed against the status total so the bars
stay internally consistent, but the two numbers come from different places upstream and
one of them is wrong.

**Open ratio excludes in-progress.** It is `open / (open + closed)`, reverse-engineered
from the original report's percentages — Edifice 3/7 = 43%, Emerald Heights 6/9 = 67%.
In-progress tickets count on neither side, so a community that moves everything into "in
progress" shows a falling open ratio without closing anything. Kept as-is so the figures
reconcile with the existing report rather than silently disagreeing with it.

## Props

`ComplaintsSummary` takes `projects`, `spotlightCount`, `initialView` and
`onSelectProject(row)`. The Detail buttons call that last one; it is currently unwired.

## Responsive

Cards go 1 → 2 → 4 columns. Below `lg` the table collapses into a tappable list rather
than a horizontal scrollbar. The wide table needs 1110px before it starts scrolling
sideways — that floor is set by the longest community name.
