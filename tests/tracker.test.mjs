import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildModel,
  candidateDates,
  countdownLabel,
  countdownTarget,
  daysUntil,
  formatDue,
  groupByPhase,
  isOverdue,
  knownCostTotal,
  parseISODate,
  previewOverrideForToggle,
  progressStats,
  safeHttpUrl,
} from "../logic.js";

const raw = readFileSync(new URL("../data/wedding.json", import.meta.url), "utf8");
const data = JSON.parse(raw);
const model = buildModel(data);
const today = new Date(2026, 10, 2);

test("seed file is public-safe JSON with the placeholder couple", () => {
  assert.equal(data.settings.coupleDisplayName, "Victor & Partner");
  assert.equal(data.settings.selectedDate, null);
  assert.equal(data.settings.guestCount, null);
  assert.equal(data.settings.budget, null);
  assert.equal(raw.includes("@"), false);
  assert.doesNotMatch(raw, /\b\d{3}[-.\s)]\d{3}[-.\s]\d{4}\b/);
  assert.equal(model.warnings.length, 0);
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

test("countdown uses the earliest remaining candidate until a date is selected", () => {
  const tentative = countdownTarget(data.settings, today);
  assert.equal(tentative.iso, "2028-02-05");
  assert.equal(tentative.tentative, true);
  assert.equal(tentative.allPast, false);
  assert.equal(countdownLabel(tentative), "Tentative · earliest remaining candidate date");
  assert.equal(daysUntil(tentative.date, today), 460);

  const later = countdownTarget(data.settings, new Date(2028, 1, 10));
  assert.equal(later.iso, "2028-02-19");

  const selected = countdownTarget({ ...data.settings, selectedDate: "2028-03-18" }, today);
  assert.equal(selected.tentative, false);
  assert.equal(selected.iso, "2028-03-18");
  assert.equal(countdownLabel(selected), "Selected date");
});

test("tasks cover the booking sequence and phases", () => {
  assert.equal(model.tasks.length, 26);
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
  assert.ok(model.tasks.every((task) => task.status === "todo"));
  const groups = groupByPhase(model.tasks, model.phases);
  assert.deepEqual(groups.map((group) => group.tasks.length), [5, 5, 3, 3, 4, 6]);
  assert.equal(formatDue(model.tasks.find((task) => task.id === "florist")), "By August 2027");
  assert.equal(formatDue(model.tasks.find((task) => task.id === "invitations-mail")), "Sunday, December 5, 2027");
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

test("preview toggles do not rewrite a matching saved status", () => {
  assert.equal(previewOverrideForToggle("todo", true), "done");
  assert.equal(previewOverrideForToggle("todo", false), null);
  assert.equal(previewOverrideForToggle("done", false), "todo");
  assert.equal(previewOverrideForToggle("done", true), null);
  assert.equal(previewOverrideForToggle("in-progress", false), null);
  const stats = progressStats(model.tasks, () => "todo");
  assert.deepEqual(stats, { total: 26, done: 0, inProgress: 0, todo: 26, percent: 0 });
});

test("vendor total sums only known numbers", () => {
  const rows = model.tasks.filter((task) => task.vendorTracked);
  assert.equal(rows.length, 16);
  assert.deepEqual(knownCostTotal(model.tasks), { total: 0, known: 0, tracked: 16 });
  const withCosts = rows.map((task, index) => ({ ...task, cost: index === 0 ? 1200 : index === 1 ? 45.5 : null }));
  assert.equal(knownCostTotal(withCosts).total, 1245.5);
  assert.equal(knownCostTotal(withCosts).known, 2);
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("https://example.com/menu"), "https://example.com/menu");
});
