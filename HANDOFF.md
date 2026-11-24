# Handoff

A shared notes board for the two assistants that edit this repo: Claude and Grokbot.

## How to use it

1. Before any edit, pull the latest repo and read this file.
2. After an edit, add a dated entry at the top of the Log: who (Claude or Grokbot), what changed in `data/wedding.json`, and anything left open for the other.
3. Never delete the other's entries. Mark open items done instead.
4. Nothing goes to a vendor without V's explicit OK.

## Open for Grokbot

- The $50k plan's catering line still assumes Kim Sơn Bronze, which V has ruled out (see the Log). It needs a replacement once a Viet Alley or Wildflower price is in.

## Open for Claude

- None yet.

## Log (newest first)

### 2026-11-24 · Claude

- Venue cards now have small galleries. Each venue in `vendors` can carry `photos` (a list of `{src, label, origin, from}`, cover first); `photo` stays as the card cover. The detail view shows labelled thumbnails, and cards show "N photos". New images are in `assets/vendors/` as `<id>-exterior.webp` and the like.
- Exterior and interior now on `v-event-centre`, `v-civic-center`, `v-holiday-inn`, `v-bowers`, `v-broussard-farm`, `v-botanical` and `v-brown-estate` (Brown Estate's cover is now its exterior, with the solarium and the old wedding shot after it).
- `v-belle-oaks` and `v-reign-hills` covers were logos; now real photos (Belle Oaks: reception and ceremony, both inside; Reign Hills: reception hall and the entrance). Neither site shows a plain building exterior.
- Open: `v-acadian` still has only its couple photo because acadianeventservices.com was down on Nov 24. `v-434-fannin` has no exterior on its site. `v-kim-son-ballroom` still has none (ruled out).
- Tests: new gallery test in `tests/tracker.test.mjs`.

### 2026-11-23 · Grokbot

- Removed The Venue at Max Bowl (`v-max-bowl`) entirely from `data/wedding.json` (`vendors` and `vendorOptions`) at V's request — not marked dropped. It was a shortlist venue, never contacted, and was not referenced in `nextActions`, `schedule`, or other vendors.
- Deleted the unused card photo `assets/vendors/v-max-bowl.webp`.
- Updated `tests/tracker.test.mjs`: vendor count 72 → 71. Set `vendorsUpdatedOn` to 2026-11-23 and updated the matching assertion.

### 2026-11-23 · Claude

- Venue photos added to the cards that had none: `v-event-centre`, `v-broussard-farm`, `v-civic-center` and `v-holiday-inn`. Each `photo` records `origin` (the image) and `from` (the venue's own page, or the city or IHG page the card links). Images are in `assets/vendors/`. Commit: "Add venue photos for Downtown Event Centre, Broussard Farm, Civic Center, Holiday Inn".
- `v-kim-son-ballroom` still has no photo: it's ruled out, and kimson.com only shows food.

### 2026-11-22 · Claude

- Vietnam pre-wedding shoot: V says it costs $1,000–1,500, replacing the $300–900 studio list range. In `budgetEstimate`, the `prewedding` line's low/high is now 1000/1500 and the $50k plan amount is 1000 (its low end). The cost-saving plan total moves to $46,681–48,046, still under $50k. Commit: "Update Vietnam photoshoot estimate to $1,000-1,500".
- Kim Sơn catering is ruled out by V on cost. That also drops Kim Sơn Bellaire Ballroom, since it requires in-house catering.
- Live caterer leads: Viet Alley and Wildflower. Wildflower is a caterer, not a florist.
- Started this file.
