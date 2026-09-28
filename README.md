# Cohort Detective

**An interactive case study in cohort analysis. Explore cohorts, see why "overall retention" lies, and investigate a retention drop step by step.**

Live demo: `https://dhavalk21.github.io/cohort-detective/`

<!-- Add a screenshot or GIF here: docs/cohort-detective.gif -->

## Why I built this

Cohort analysis is usually taught as a chart type. In practice it is a way of thinking:

> **GROUP → TRACK → COMPARE → EXPLAIN → ACT**

Most cohort tools stop at COMPARE. This one goes all the way to ACT: it lets you investigate a problem the way a product manager would, and it shows the traps along the way.

## What's in it

| Module | What it shows |
| --- | --- |
| **1. Cohort explorer** | Group by signup month, channel, plan, segment or geography. Switch between retention and revenue, heatmap and curves. Combine a filter with a cohort (for example *Enterprise* × signup month) to see how **segmentation** ("who behaves differently?") differs from **cohort analysis** ("how does a group behave over time?"). |
| **2. The mix trap** | Sliders for signup growth and true cohort quality. Overall retention can rise while every cohort gets worse, because new users haven't had time to churn. |
| **3. Guided case** | *"Retention dropped from 40% to 30%."* A seven-step investigation: validate → segment → locate → find the change → find the behaviour → hypothesis → test. Wrong turns get feedback. Every chart is computed live from the dataset. |

## The dataset (and the decisions behind it)

All data is **synthetic**, generated in `data.js` from a fixed seed (6,780 signups, Jan–Sep 2026), so results are identical on every load.

The story is deliberately baked in so the guided case has a real answer:

- **Metric definition.** Retention = share of a cohort's signups with any activity in month *N* since signup. Cohorts too young to have a month *N* show a dash rather than a misleading zero.
- **The cause.** Onboarding v2 ships on **Apr 8**. Activation (reaching first value) falls from ~70% to ~44%, concentrated at the first-value step.
- **The mechanism.** Activated users retain about 4× better than non-activated users, and they retain the *same* before and after v2. Fewer users get activated, so retention falls from ~39% to ~30%.
- **A red herring.** A paid campaign scales up on Apr 1. Retention falls *inside every channel*, and re-weighting to the old channel mix closes almost none of the gap, so the tool lets you check that hypothesis and rule it out.
- **Same-month control.** April signups before and after Apr 8 sit in the same month with the same campaign, which separates "the calendar" from "the release".

Because it is synthetic, the tool proves a way of reasoning, not a real-world finding.

## Tech

Plain HTML, CSS and vanilla JavaScript. No build step, no dependencies, no backend. Charts are hand-rolled SVG.

```
index.html   page shell and tabs
style.css    theme (light/dark), layout
data.js      seeded synthetic dataset and cohort maths
ui.js        DOM/SVG helpers (heat colours, line chart, bars)
explorer.js  module 1
simulator.js module 2
case.js      module 3
app.js       tab routing
```
