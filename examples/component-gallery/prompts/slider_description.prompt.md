---
type: noResponse
name: slider_description
---

# Slider

Continuous numeric scale: `min` → `max` in `interval` steps.

The participant clicks anywhere on the bar to set their answer. The
thumb is **deliberately hidden until first interaction** so the
starting position doesn't anchor their response (#326).

Tick labels can be added at any subset of the snap points. Common
patterns are labels at just the endpoints (anchored Likert), or at
every snap point (full 7-point scale with each number labelled).

Three sliders are shown below to illustrate different combinations:
endpoint + midpoint labels with `showValue: true`, a 0–100
fine-grained slider with the snap-tick graceful-degradation
behavior visible, and a 5-point Likert with every position
labelled.
