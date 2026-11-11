import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyEdits,
  budgetTotals,
  fitReport,
  guestSideTotal,
  guestTablePlan,
  monthsInRange,
  tasksInMonth,
  buildModel,
  buildUpdatePayload,
  candidateDates,
  countdownLabel,
  countdownTarget,
  dateListMarker,
  daysUntil,
  diffTask,
  estimateLine,
  extraTrayCarriers,
  formatDue,
  githubIssueUrl,
  groupByPhase,
  groupVendorOptions,
  isOverdue,
  knownCostTotal,
  nextOpenTarget,
  perGuestCeiling,
  planTotals,
  parseISODate,
  progressStats,
  pruneEdits,
  safeHttpUrl,
  snapshotFromDraft,
  statusAfterMarkDone,
  viewFromHash,
} from "../logic.js";

const raw = readFileSync(new URL("../data/wedding.json", import.meta.url), "utf8");
const data = JSON.parse(raw);
const model = buildModel(data);
const today = new Date(2026, 10, 2);

test("seed file is public-safe JSON for Victor & Mít", () => {
  assert.equal(data.settings.coupleDisplayName, "Victor & Mít");
  assert.equal(raw.includes("Mít"), true);
  assert.equal(raw.includes("\\u00ed"), false);
  assert.equal(data.settings.idealDate, "2028-03-18");
  assert.equal(data.settings.selectedDate, null);
  assert.equal(raw.includes("2028-03-04"), false);
  assert.equal(data.settings.guestCount, 200);
  assert.equal(data.settings.budget, 50000);
  assert.equal(/victorvuong/i.test(raw), false);
  assert.equal(model.warnings.length, 0);
});

test("the hash opens one section, all sections, or overview by default", () => {
  assert.equal(viewFromHash(""), "overview");
  assert.equal(viewFromHash("#"), "overview");
  assert.equal(viewFromHash("#overview"), "overview");
  assert.equal(viewFromHash("#progress"), "progress");
  assert.equal(viewFromHash("#timeline"), "timeline");
  assert.equal(viewFromHash("#tasks"), "timeline");
  assert.equal(viewFromHash("#vendors"), "vendors");
  assert.equal(viewFromHash("#ceremony"), "ceremony");
  assert.equal(viewFromHash("#guests"), "guests");
  assert.equal(viewFromHash("#outreach"), "outreach");
  assert.equal(viewFromHash("#months"), "months");
  assert.equal(viewFromHash("#dayof"), "dayof");
  assert.equal(viewFromHash("#all"), "all");
  assert.equal(viewFromHash("#ALL"), "all");
  assert.equal(viewFromHash("#somewhere-else"), "overview");
});

test("candidate Saturdays and Tết are real dates", () => {
  for (const iso of ["2028-02-05", "2028-02-19", "2028-03-18"]) {
    assert.equal(parseISODate(iso).getDay(), 6, iso);
  }
  assert.deepEqual(candidateDates(data.settings).map((item) => item.iso), [
    "2028-02-05",
    "2028-02-19",
    "2028-03-18",
  ]);
  assert.equal(parseISODate("2028-01-26")?.toDateString(), new Date(2028, 0, 26).toDateString());
  assert.equal(parseISODate("2027-02-29"), null);
  assert.ok(parseISODate("2028-02-29"));
});

test("countdown uses the ideal date until a Saturday is selected", () => {
  const tentative = countdownTarget(data.settings, today);
  assert.equal(tentative.iso, "2028-03-18");
  assert.equal(tentative.tentative, true);
  assert.equal(tentative.ideal, true);
  assert.equal(tentative.allPast, false);
  assert.equal(countdownLabel(tentative), "Tentative · ideal date");
  assert.equal(daysUntil(tentative.date, today), 502);
  assert.equal(dateListMarker({ iso: "2028-03-18", idealIso: "2028-03-18" }), "Ideal");
  assert.equal(dateListMarker({ iso: "2028-02-05", idealIso: "2028-03-18" }), "Alternative");
  assert.equal(dateListMarker({ iso: "2028-02-19", idealIso: "2028-03-18" }), "Alternative");

  const passed = countdownTarget(data.settings, new Date(2028, 2, 19));
  assert.equal(passed.iso, "2028-03-18");
  assert.equal(passed.allPast, true);
  assert.equal(countdownLabel(passed), "Tentative · ideal date has passed");

  const noIdeal = countdownTarget({ ...data.settings, idealDate: null }, new Date(2028, 1, 10));
  assert.equal(noIdeal.iso, "2028-02-19");
  assert.equal(noIdeal.ideal, false);
  assert.equal(countdownLabel(noIdeal), "Tentative · earliest remaining candidate date");

  const selected = countdownTarget({ ...data.settings, selectedDate: "2028-02-05" }, today);
  assert.equal(selected.tentative, false);
  assert.equal(selected.ideal, false);
  assert.equal(selected.iso, "2028-02-05");
  assert.equal(countdownLabel(selected), "Selected date");
});

test("tasks cover the booking sequence and phases", () => {
  assert.equal(model.tasks.length, 34);
  assert.deepEqual(model.phases.map((phase) => phase.id), [
    "now",
    "early-2027",
    "spring-summer-2027",
    "vietnam-2027",
    "autumn-2027",
    "final",
  ]);
  const ids = model.tasks.map((task) => task.id);
  for (const id of [
    "guest-count",
    "pick-date",
    "venue-reception",
    "venue-tea",
    "catering",
    "planner",
    "photo-dayof",
    "officiant",
    "mc",
    "music",
    "hmu",
    "florist",
    "attire-vietnam",
    "photo-vietnam",
    "invitations-print",
    "cake",
    "transport",
    "invitations-mail",
    "mam-qua",
    "lion",
    "rsvps",
  ]) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(model.tasks.find((task) => task.id === "mc").vendorName, "Tuấn");
  assert.equal(model.tasks.find((task) => task.id === "sax").status, "researching");
  assert.ok(model.tasks.filter((task) => task.id !== "sax").every((task) => task.status === "todo"));
  const groups = groupByPhase(model.tasks, model.phases);
  assert.deepEqual(groups.map((group) => group.tasks.length), [5, 6, 6, 3, 4, 10]);
  assert.equal(model.tasks.find((task) => task.id === "invitations-mail").phase, "final");
  assert.equal(formatDue(model.tasks.find((task) => task.id === "florist")), "By August 2027");
  assert.equal(formatDue(model.tasks.find((task) => task.id === "invitations-mail")), "Sunday, January 16, 2028");
  assert.equal(formatDue(model.tasks.find((task) => task.id === "rsvps")), "Thursday, March 2, 2028");
});

test("overdue highlighting follows the due date and ignores done work", () => {
  const task = { due: "2026-10-01", dueMonth: "", status: "todo" };
  assert.equal(isOverdue(task, "todo", today), true);
  assert.equal(isOverdue(task, "done", today), false);
  assert.equal(isOverdue({ due: "", dueMonth: "2026-10" }, "todo", today), true);
  assert.equal(isOverdue({ due: "", dueMonth: "2026-11" }, "in-progress", today), false);
  assert.equal(isOverdue({ due: "2026-11-02", dueMonth: "" }, "todo", today), false);
  assert.equal(model.tasks.some((task) => isOverdue(task, task.status, today)), false);
});

test("booked and done count as complete, and mark done can restore the file", () => {
  assert.equal(statusAfterMarkDone("todo", "todo"), "done");
  assert.equal(statusAfterMarkDone("booked", "todo"), "done");
  assert.equal(statusAfterMarkDone("done", "todo"), "todo");
  assert.equal(statusAfterMarkDone("done", "researching"), "researching");
  assert.equal(statusAfterMarkDone("done", "done"), "todo");
  const stats = progressStats(model.tasks, () => "todo");
  assert.deepEqual(stats, { total: 34, done: 0, inProgress: 0, todo: 34, percent: 0 });
  const mixed = progressStats(
    [
      { status: "booked" },
      { status: "done" },
      { status: "researching" },
      { status: "contacted" },
      { status: "todo" },
    ],
    (task) => task.status,
  );
  assert.deepEqual(mixed, { total: 5, done: 2, inProgress: 2, todo: 1, percent: 40 });
});

test("local edits layer over the file and feed progress, costs, and the issue", () => {
  const venue = model.tasks.find((task) => task.id === "venue-reception");
  const guest = model.tasks.find((task) => task.id === "guest-count");
  assert.equal(isOverdue({ due: "2026-01-01", dueMonth: "" }, "booked", today), false);
  assert.equal(diffTask(venue, venue).status, undefined);
  const { errors, snapshot } = snapshotFromDraft({
    title: "Book a reception venue",
    category: "Venue",
    phase: "now",
    status: "booked",
    notes: venue.notes,
    duePrecision: "day",
    due: "2027-01-20",
    dueMonth: "",
    vendorTracked: true,
    vendorName: "Example Hall",
    vendorPhone: "",
    vendorUrl: "https://example.com",
    cost: "12,000",
    deposit: "2000",
    balanceDue: "2027-06-01",
  });
  assert.deepEqual(errors, []);
  const patch = diffTask(venue, snapshot);
  assert.equal(patch.status, "booked");
  assert.equal(patch.cost, 12000);
  assert.equal(patch.deposit, 2000);
  assert.equal(patch.vendorName, "Example Hall");
  assert.equal(patch.title, undefined);
  assert.equal(patch.notes, undefined);
  const roundTrip = snapshotFromDraft({
    title: venue.title,
    category: venue.category,
    phase: venue.phase,
    status: venue.status,
    notes: venue.notes,
    duePrecision: "month",
    due: "",
    dueMonth: venue.dueMonth,
    vendorTracked: true,
    vendorName: "",
    vendorPhone: "",
    vendorUrl: "",
    cost: "",
    deposit: "",
    balanceDue: "",
  });
  assert.deepEqual(roundTrip.errors, []);
  assert.deepEqual(diffTask(venue, roundTrip.snapshot), {});
  const guestDraft = snapshotFromDraft({
    title: guest.title,
    category: guest.category,
    phase: guest.phase,
    status: guest.status,
    notes: guest.notes,
    duePrecision: "day",
    due: guest.due,
    dueMonth: "",
    vendorTracked: false,
    vendorName: "Ignored",
    vendorPhone: "",
    vendorUrl: "",
    cost: "50",
    deposit: "",
    balanceDue: "",
  });
  assert.deepEqual(guestDraft.errors, []);
  assert.deepEqual(diffTask(guest, guestDraft.snapshot), {});

  const edits = pruneEdits(model.tasks, {
    "venue-reception": patch,
    "guest-count": "done",
    lion: { _op: "delete" },
    "photo-extra": {
      _op: "add",
      id: "photo-extra",
      title: "Book a second photographer",
      category: "Photo & video",
      phase: "early-2027",
      status: "researching",
      notes: "",
      due: "2027-04-15",
      dueMonth: "",
      vendorTracked: true,
      cost: 800,
    },
    missing: { _op: "delete" },
  });
  assert.equal(edits["guest-count"].status, "done");
  assert.equal(edits.missing, undefined);
  const view = applyEdits(model.tasks, edits);
  assert.equal(view.some((task) => task.id === "lion"), false);
  assert.equal(view.at(-1).id, "photo-extra");
  assert.equal(view.find((task) => task.id === "venue-reception").cost, 12000);
  assert.equal(view.find((task) => task.id === "guest-count").status, "done");
  const stats = progressStats(view, (task) => task.status);
  assert.equal(stats.done, 2);
  assert.equal(stats.inProgress, 2);
  assert.equal(knownCostTotal(view).total, 12800);
  assert.equal(nextOpenTarget(view, today).task.id, "pick-date");

  const payload = buildUpdatePayload(model.tasks, edits, "2026-11-03", "USD", model.phases);
  assert.equal(payload.title, "Tracker updates 2026-11-03");
  assert.match(payload.body, /```json/);
  assert.equal(payload.document.changes["venue-reception"].status, "booked");
  assert.match(payload.summaryLines.join("\n"), /Example Hall/);
  assert.match(payload.summaryLines.join("\n"), /Removed “Decide on a lion dance”/);
  const link = githubIssueUrl({ title: payload.title, body: payload.body, maxUrlLength: 7000 });
  assert.equal(link.tooLong, false);
  assert.match(link.url, /^https:\/\/github.com\/victorv83\/Wedding-Planner\/issues\/new\?/);
  const huge = githubIssueUrl({ title: "Tracker updates 2026-11-03", body: "x".repeat(8000), maxUrlLength: 500 });
  assert.equal(huge.tooLong, true);
  assert.doesNotMatch(huge.url, /x{100}/);
  assert.match(decodeURIComponent(huge.url), /clipboard/);

  const unchanged = pruneEdits(model.tasks, { "venue-reception": { status: "todo" } });
  assert.deepEqual(unchanged, {});
  const rejected = snapshotFromDraft({
    title: "",
    category: "Venue",
    phase: "now",
    status: "todo",
    notes: "",
    duePrecision: "none",
    vendorTracked: true,
    vendorUrl: "javascript:alert(1)",
    cost: "nope",
  });
  assert.ok(rejected.errors.length >= 2);
});

test("vendor total sums only known numbers", () => {
  const rows = model.tasks.filter((task) => task.vendorTracked);
  assert.equal(rows.length, 22);
  assert.deepEqual(knownCostTotal(model.tasks), { total: 0, known: 0, tracked: 22 });
  const withCosts = rows.map((task, index) => ({ ...task, cost: index === 0 ? 1200 : index === 1 ? 45.5 : null }));
  assert.equal(knownCostTotal(withCosts).total, 1245.5);
  assert.equal(knownCostTotal(withCosts).known, 2);
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("https://example.com/menu"), "https://example.com/menu");
});

test("budget prices 175 and 250 guests and keeps parties out of the wedding total", () => {
  const { budget } = model;
  assert.equal(data.settings.budget, 50000);
  assert.deepEqual(budget.guestCounts, [200, 175, 250]);
  const atBaseline = fitReport(budget, 200, 50000);
  assert.equal(atBaseline.planFitsHigh, true);
  assert.equal(atBaseline.estimateFitsHigh, false);
  assert.equal(guestSideTotal(data.guestPlan), 200);
  assert.equal(guestTablePlan(data.guestPlan).tables, 20);
  assert.deepEqual(monthsInRange("2026-11", "2027-01"), ["2026-11", "2026-12", "2027-01"]);
  assert.ok(tasksInMonth(model.tasks, "2028-01").some((task) => task.id === "bachelor"));
  const catering = budget.lines.find((line) => line.id === "catering");
  assert.deepEqual(estimateLine(catering, 175), { low: 14525, high: 28350 });
  assert.deepEqual(estimateLine(catering, 250), { low: 20750, high: 40500 });
  const teaPlace = budget.lines.find((line) => line.id === "tea-place");
  assert.deepEqual(estimateLine(teaPlace, 200), { low: 0, high: 0 });
  for (const guests of [175, 250]) {
    const totals = budgetTotals(budget, guests);
    const weddingLines = budget.lines.filter((line) => line.group === "wedding");
    const lowSum = weddingLines.reduce((sum, line) => sum + estimateLine(line, guests).low, 0);
    assert.equal(totals.groups.wedding.low, lowSum);
    assert.equal(totals.contingency.low, Math.round(lowSum * 0.1));
    assert.equal(totals.wedding.low, lowSum + totals.contingency.low);
    assert.ok(totals.groups.parties.low > 0);
    assert.ok(totals.wedding.high > 50000, "the high estimate is over the $50k target");
  }
  const plan = planTotals(budget);
  assert.equal(plan.options.length, 2);
  assert.ok(plan.cautious.amount > plan.options.find((option) => option.id === "byo").amount);
  assert.ok(plan.cautious.total.high < 50000, "the cautious $50k plan still fits");
  assert.equal(perGuestCeiling(50000, 175), 285);
  assert.equal(perGuestCeiling(50000, 200), 250);
  assert.equal(perGuestCeiling(50000, 250), 200);
  const dj = budget.plan.lines.find((line) => line.lineId === "dj");
  const lion = budget.plan.lines.find((line) => line.lineId === "lion");
  const venuePlan = budget.plan.lines.find((line) => line.lineId === "venue");
  assert.equal(dj.over, "");
  assert.equal(venuePlan.amount, 2650);
  assert.equal(lion.over, "over");
  for (const line of budget.lines) {
    if (line.taskId) assert.ok(model.tasks.some((task) => task.id === line.taskId), line.id);
  }
});

test("wedding party of 4 + 4 needs extra tray carriers for 5 or 7 trays", () => {
  const party = model.weddingParty;
  assert.equal(party.bridesmaids, 4);
  assert.equal(party.groomsmen, 4);
  assert.deepEqual(party.teaCeremonyTrays, [5, 7]);
  assert.equal(extraTrayCarriers(party, 5), 1);
  assert.equal(extraTrayCarriers(party, 7), 3);
  assert.equal(extraTrayCarriers(party, 3), 0);
});

test("vendor shortlist covers the bookings and states venue alcohol rules", () => {
  const vendors = model.vendorOptions;
  assert.ok(vendors.length >= 40);
  const categories = groupVendorOptions(vendors).map((group) => group.category);
  for (const category of ["Venue", "Catering", "Planner", "Photo & video", "Music & MC", "Beauty", "Flowers & decor", "Cake", "Rentals", "Bar", "Transportation", "Ceremony", "Attire", "Parties"]) {
    assert.ok(categories.includes(category), category);
  }
  const ids = new Set();
  for (const vendor of vendors) {
    assert.ok(!ids.has(vendor.id), vendor.id);
    ids.add(vendor.id);
    if (vendor.url) assert.match(vendor.url, /^https:\/\//, vendor.name);
    else assert.match(`${vendor.pricing} ${vendor.caveat}`, /confirm|unknown|not found/i, vendor.name);
    assert.ok(model.tasks.some((task) => task.id === vendor.taskId), vendor.name);
    assert.ok(vendor.fit, vendor.name);
  }
  const centre = vendors.find((vendor) => vendor.id === "v-event-centre");
  assert.equal(centre.byoAlcohol, "bartender");
  assert.equal(centre.outsideCatering, "approved");
  assert.match(centre.caveat, /only if a rite/);
  const belle = vendors.find((vendor) => vendor.id === "v-belle-oaks");
  assert.equal(belle.byoAlcohol, "unknown");
  assert.equal(belle.outsideCatering, "yes");
  assert.doesNotMatch(belle.caveat, /for sale/i);
  assert.ok(vendors.some((vendor) => vendor.taskId === "bachelor"));
  assert.ok(vendors.some((vendor) => vendor.taskId === "sax") === false);
  assert.equal(model.tasks.find((task) => task.id === "sax").status, "researching");
  assert.equal(model.tasks.find((task) => task.id === "venue-tea").byoAlcohol, "yes");
  assert.match(model.tasks.find((task) => task.id === "bachelor").due, /^2028-01-1/);
  assert.equal(raw.includes("Lagayette"), false);
  assert.equal(raw.includes("2028-03-04"), false);
});

test("bad budget and vendor entries warn instead of breaking the page", () => {
  const broken = buildModel({
    settings: data.settings,
    phases: data.phases,
    tasks: [{ id: "a", title: "A", category: "Venue" }],
    budgetEstimate: { guestCounts: [100], lines: [
      { id: "x", item: "Backwards", flat: { low: 10, high: 5 } },
      { id: "y", item: "Empty" },
      { id: "z", item: "Orphan", taskId: "nope", flat: { low: 1, high: 2 } },
    ] },
    vendorOptions: [
      { name: "Sketchy", url: "javascript:alert(1)", taskId: "a", category: "Venue" },
      { url: "https://example.com" },
    ],
  });
  assert.equal(broken.budget.lines.length, 1);
  assert.equal(broken.vendorOptions.length, 1);
  assert.equal(broken.vendorOptions[0].url, "");
  assert.ok(broken.warnings.length >= 5);
});
