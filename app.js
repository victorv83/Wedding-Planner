import {
  ALCOHOL_POLICIES,
  BUDGET_GROUPS,
  CATERING_POLICIES,
  STATUS_LABELS,
  STATUS_ORDER,
  SECTION_IDS,
  applyEdits,
  buildModel,
  buildUpdatePayload,
  candidateDates,
  categoriesInOrder,
  categorySuggestsVendor,
  countdownLabel,
  countdownTarget,
  countdownWords,
  dateListMarker,
  daysUntil,
  diffTask,
  estimateLine,
  extraTrayCarriers,
  displayCouple,
  editCounts,
  formatDue,
  formatISO,
  formatLongDate,
  formatMoney,
  formatNumber,
  githubIssueUrl,
  groupByPhase,
  groupVendorOptions,
  isCompleteStatus,
  isOverdue,
  isUnderwayStatus,
  knownCostTotal,
  nextOpenTarget,
  perGuestCeiling,
  planTotals,
  parseISODate,
  progressStats,
  budgetTotals,
  pruneEdits,
  resolveDue,
  roughSpan,
  safeHttpUrl,
  serializeAdd,
  settingText,
  slugTaskId,
  snapshotFromDraft,
  startOfToday,
  statusAfterMarkDone,
  taskSnapshot,
  viewFromHash,
  fitReport,
  lineCost,
  normalizeQuotes,
  parseMoneyInput,
  quotesByTask,
} from "./logic.js";
import {
  applyGuestEdits,
  guestEditsDirty,
  loadGuestEdits,
  renderCeremony,
  renderDayOf,
  renderGuests,
  renderMonths,
  renderOutreach,
  saveGuestEdits,
} from "./guides.js";

const STORAGE_KEY = "weddingPlanner.localEdits.v1";
const LEGACY_STORAGE_KEY = "weddingPlanner.previewStatus.v1";
const QUOTE_KEY = "weddingPlanner.quotes.v1";
const ACTION_KEY = "weddingPlanner.nextActions.v1";
const UNIT_KEY = "weddingPlanner.cateringUnit.v1";
const NEW_ITEM = "__new__";

const state = {
  model: null,
  statusFilter: "all",
  categoryFilter: "all",
  edits: {},
  editingId: null,
  draft: null,
  formErrors: [],
  issue: null,
  guides: null,
  guestEdits: null,
  quotes: {},
  actionChecks: {},
  cateringUnit: "per-table",
  openQuoteId: null,
  quoteError: null,
};

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "hidden") node.hidden = Boolean(value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function fieldInput(tag, attrs, value) {
  const node = el(tag, attrs);
  if (value != null) node.value = value;
  return node;
}

function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(key, value) {
  try {
    if (!value) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* In-memory edits still work for this visit. */
  }
}

function loadEdits() {
  const current = readJsonStorage(STORAGE_KEY) || {};
  const legacy = readJsonStorage(LEGACY_STORAGE_KEY);
  if (legacy) {
    for (const [id, value] of Object.entries(legacy)) {
      if (current[id] == null) current[id] = value;
    }
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* Keep the legacy key if storage is blocked. pruneEdits still understands it. */
    }
  }
  return current;
}

function saveEdits(edits) {
  try {
    if (!edits || Object.keys(edits).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch {
    /* Private mode and blocked storage still allow an in-memory edit. */
  }
}

function viewTasks() {
  return applyEdits(state.model.tasks, state.edits);
}

function baselineTask(id) {
  return state.model.tasks.find((task) => task.id === id) || null;
}

function currency() {
  return settingText(state.model.settings, "currency") || "USD";
}

function savedQuotes() {
  return normalizeQuotes(state.quotes);
}

function currentQuoteMap() {
  return quotesByTask(state.model?.vendorOptions, savedQuotes());
}

function currentScenario() {
  const scenarios = state.model?.budget?.plan?.unitScenarios || [];
  return scenarios.find((item) => item.id === state.cateringUnit) || null;
}

function quotesDirty() {
  return Object.keys(savedQuotes()).length > 0;
}

function actionsDirty() {
  return Object.values(state.actionChecks || {}).some(Boolean);
}

function unitDirty() {
  return state.cateringUnit && state.cateringUnit !== "per-table";
}

function usingEdits() {
  return editCounts(state.edits).total > 0
    || guestEditsDirty(state.model?.guestPlan, state.guestEdits)
    || quotesDirty()
    || actionsDirty()
    || unitDirty();
}

function renderShellText() {
  const { settings } = state.model;
  const name = displayCouple(settings);
  const target = countdownTarget(settings, startOfToday());
  $("couple-name").textContent = name;
  document.title = `${name} · Wedding plans`;
  $("footer-line").textContent = `${name} · wedding planning tracker`;

  const vi = settingText(settings, "vietnameseSubtitle");
  const viNode = $("vi-line");
  viNode.textContent = vi;
  viNode.hidden = !vi;

  const celebration = settingText(settings, "celebration");
  const celebrationNode = $("celebration");
  if (celebration) fillRich(celebrationNode, celebration);
  else celebrationNode.replaceChildren();
  celebrationNode.hidden = !celebration;

  const place = settingText(settings, "place");
  const placeNode = $("place");
  placeNode.textContent = place;
  placeNode.hidden = !place;

  $("plan-year").textContent = target ? String(target.date.getFullYear()) : "";
}

const VIETNAMESE_TERMS = ["Tết Nguyên Đán", "lễ gia tiên", "áo dài", "mâm quả"];

function richText(text) {
  const parts = [];
  let remaining = text;
  while (remaining) {
    let at = -1;
    let term = "";
    for (const candidate of VIETNAMESE_TERMS) {
      const index = remaining.indexOf(candidate);
      if (index !== -1 && (at === -1 || index < at)) {
        at = index;
        term = candidate;
      }
    }
    if (at === -1) {
      parts.push(remaining);
      break;
    }
    if (at > 0) parts.push(remaining.slice(0, at));
    parts.push(el("span", { class: "keep", lang: "vi", text: term }));
    remaining = remaining.slice(at + term.length);
  }
  return parts;
}

function fillRich(node, text) {
  node.replaceChildren(...richText(text));
}

function badge(status) {
  const kind = status === "done"
    ? "done"
    : status === "booked"
      ? "booked"
      : isUnderwayStatus(status)
        ? "progress"
        : "todo";
  return el("span", { class: `badge badge-${kind}`, text: STATUS_LABELS[status] || STATUS_LABELS.todo });
}

function pencilIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z");
  svg.append(path);
  return svg;
}

function duePhrase(days, precision) {
  if (days == null) return "";
  if (days === 0) return precision === "month" ? "Due this month" : "Due today";
  const count = Math.abs(days);
  const unit = count === 1 ? "day" : "days";
  if (days > 0) return precision === "month" ? `${count} ${unit} until month end` : `${count} ${unit} to go`;
  return `${count} ${unit} overdue`;
}

function taskDuePhrase(task, today) {
  const due = resolveDue(task);
  if (!due) return "";
  return duePhrase(daysUntil(due.date, today), due.precision);
}

function meter(label, stats, describedBy) {
  const bar = el("div", {
    class: "bar",
    role: "progressbar",
    "aria-valuemin": "0",
    "aria-valuemax": "100",
    "aria-valuenow": String(stats.percent),
    "aria-label": label,
  }, [el("span", { style: `width: ${stats.percent}%` })]);
  return el("div", { class: "meter" }, [
    el("div", { class: "meter-label" }, [
      el("span", { text: label }),
      el("span", { text: `${stats.done} / ${stats.total}` }),
    ]),
    bar,
    describedBy ? el("p", { class: "sr-only", text: describedBy }) : null,
  ]);
}

function renderWarnings() {
  const mount = $("warnings");
  const { warnings } = state.model;
  if (!warnings.length) {
    mount.replaceChildren();
    return;
  }
  mount.replaceChildren(
    el("div", { class: "warning", role: "status" }, [
      el("strong", { text: "Check the data file" }),
      el("ul", {}, warnings.map((warning) => el("li", { text: warning }))),
    ]),
  );
}

function renderNextActions() {
  const actions = state.model.nextActions || [];
  if (!actions.length) return null;
  const done = actions.filter((action) => state.actionChecks[action.id]).length;
  return el("div", { class: "panel next-actions" }, [
    el("h3", { class: "subhead", id: "next-actions-heading", text: "Next 5 actions" }),
    el("p", { class: "hint", text: `${done} of ${actions.length} checked. Checks stay on this device until you send updates.` }),
    el("ul", { class: "action-list" }, actions.map((action) => {
      const input = el("input", { type: "checkbox", id: `action-${action.id}` });
      input.checked = Boolean(state.actionChecks[action.id]);
      input.addEventListener("change", () => {
        const next = { ...state.actionChecks };
        if (input.checked) next[action.id] = true;
        else delete next[action.id];
        state.actionChecks = next;
        writeJsonStorage(ACTION_KEY, Object.keys(next).length ? next : null);
        render({ focusId: input.id });
      });
      return el("li", {}, [
        el("label", {}, [input, el("span", { text: action.label })]),
      ]);
    })),
  ]);
}

function renderOverview() {
  const { settings } = state.model;
  const today = startOfToday();
  const tasks = viewTasks();
  const target = countdownTarget(settings, today);
  const candidates = candidateDates(settings);
  const selectedIso = target && !target.tentative ? target.iso : "";
  const idealIso = target?.ideal ? target.iso : "";
  const fallbackIso = target?.tentative && !target.ideal ? target.iso : "";
  const next = nextOpenTarget(tasks, today);

  let countdownBlock;
  if (!target) {
    countdownBlock = el("div", {}, [
      el("p", { class: "countdown-label", text: "No date yet" }),
      el("p", { text: "Add candidateDates or selectedDate in data/wedding.json." }),
    ]);
  } else {
    const days = daysUntil(target.date, today);
    const words = countdownWords(days);
    const span = roughSpan(days);
    const label = countdownLabel(target);
    const longDate = formatLongDate(target.date);
    countdownBlock = el("div", { class: "overview-grid" }, [
      el("p", { class: "days-number", text: words.number }),
      el("div", {}, [
        el("p", { class: "sr-only", text: `${words.number} ${words.unit}. ${label}. ${longDate}.` }),
        el("p", { class: "days-unit", text: words.unit }),
        el("p", { class: "countdown-label", text: label }),
        el("p", { class: "countdown-date" }, [
          el("time", { datetime: target.iso, text: longDate }),
        ]),
        span ? el("p", { class: "rough", text: span }) : null,
      ]),
    ]);
  }

  const dateItems = candidates.map((candidate) => {
    const marker = dateListMarker({
      iso: candidate.iso,
      idealIso,
      selectedIso,
      fallbackIso,
      allPast: Boolean(target?.allPast),
    });
    const current = candidate.iso === selectedIso || candidate.iso === idealIso || candidate.iso === fallbackIso;
    return el("li", current ? { "aria-current": "date" } : {}, [
      el("time", { datetime: candidate.iso, text: formatLongDate(candidate.date) }),
      el("span", { class: "badge", text: marker }),
    ]);
  });

  const facts = [];
  const guests = settings.guestCount;
  facts.push(["Guests", typeof guests === "number" && Number.isFinite(guests) ? formatNumber(guests) : "Not set"]);
  const budget = settings.budget;
  facts.push(["Budget target", typeof budget === "number" && Number.isFinite(budget) ? formatMoney(budget, currency()) : "Not set"]);
  const tet = parseISODate(settings.tetDate);
  if (tet) {
    const label = settingText(settings, "tetLabel") || "Tết";
    facts.push([label, formatLongDate(tet), true]);
  }

  const nextLine = next
    ? el("p", { class: "next-target" }, [
      el("span", { class: "next-kicker", text: "Next open target" }),
      el("strong", { text: next.task.title }),
      el("span", { text: `${formatDue(next.task)} · ${duePhrase(next.days, next.due.precision)}` }),
    ])
    : null;

  const section = el("section", { class: "section", id: "overview", "aria-labelledby": "overview-heading" }, [
    renderNextActions(),
    el("h2", { id: "overview-heading", text: "Countdown" }),
    el("div", { class: "panel" }, [
      countdownBlock,
      nextLine,
      el("h3", { class: "subhead", text: idealIso ? "Ideal date and alternatives" : "Candidate dates" }),
      dateItems.length
        ? el("ul", { class: "date-list" }, dateItems)
        : el("p", { text: "No candidate dates are listed yet." }),
      el("dl", { class: "facts" }, facts.map(([label, value, vietnamese]) => el("div", {}, [
        el("dt", vietnamese ? { lang: "vi", text: label } : { text: label }),
        el("dd", {}, [vietnamese ? el("time", { datetime: settings.tetDate, text: value }) : value]),
      ]))),
    ]),
  ]);

  $("mount-overview").replaceChildren(section);
}

function sendButton(id) {
  const count = editCounts(state.edits).total
    + (guestEditsDirty(state.model?.guestPlan, state.guestEdits) ? 1 : 0)
    + (quotesDirty() ? 1 : 0)
    + (actionsDirty() ? 1 : 0)
    + (unitDirty() ? 1 : 0);
  const button = el("button", {
    type: "button",
    class: "primary send-updates",
    id,
    text: count ? `Send updates (${count})` : "Send updates",
  });
  button.addEventListener("click", openIssuePreview);
  return button;
}

function resetButton(id) {
  const button = el("button", { type: "button", class: "reset-edits", id, text: "Reset local edits" });
  button.addEventListener("click", resetEdits);
  return button;
}

function renderProgress() {
  const tasks = viewTasks();
  const { phases } = state.model;
  const stats = progressStats(tasks, (task) => task.status);
  const counts = editCounts(state.edits);
  const described = counts.total
    ? "Includes unsent edits on this device. Booked and done count as complete."
    : "From data/wedding.json. Booked and done count as complete.";

  const phaseMeters = groupByPhase(tasks, phases)
    .filter((group) => group.tasks.length > 0)
    .map((group) => meter(group.phase.title, progressStats(group.tasks, (task) => task.status), described));

  const categoryMeters = categoriesInOrder(tasks).map((category) => {
    const subset = tasks.filter((task) => task.category === category);
    return meter(category, progressStats(subset, (task) => task.status), described);
  });

  const callout = counts.total
    ? el("div", { class: "preview-callout" }, [
      el("p", {}, [
        el("strong", { text: "Unsent edits: " }),
        `${counts.updated} updated, ${counts.added} added, ${counts.deleted} removed. Bars, the next target, and the cost table include them. They stay in this browser until you send updates or reset.`,
      ]),
      el("div", { class: "form-actions" }, [
        sendButton("send-updates-progress"),
        resetButton("reset-edits-progress"),
      ]),
    ])
    : null;

  const section = el("section", { class: "section", id: "progress", "aria-labelledby": "progress-heading" }, [
    el("h2", { id: "progress-heading", text: "Progress" }),
    el("div", { class: "panel" }, [
      el("div", { class: "progress-hero" }, [
        el("p", { class: "percent" }, [String(stats.percent), el("span", { text: "%" })]),
        el("div", {}, [
          el("p", { class: "source", text: counts.total ? "Includes unsent edits on this device" : "Saved in data/wedding.json" }),
          el("div", {
            class: "bar",
            role: "progressbar",
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "aria-valuenow": String(stats.percent),
            "aria-label": "Overall progress",
          }, [el("span", { style: `width: ${stats.percent}%` })]),
          el("p", {
            class: "fraction",
            id: "progress-summary",
            text: `${stats.done} of ${stats.total} complete · ${stats.inProgress} underway`,
          }),
          el("p", { class: "hint tight", text: "Booked and done both count as complete." }),
        ]),
      ]),
      callout,
      el("h3", { class: "subhead", text: "By phase" }),
      el("div", { class: "meter-grid" }, phaseMeters),
      el("h3", { class: "subhead", text: "By category" }),
      el("div", { class: "meter-grid" }, categoryMeters),
    ]),
  ]);

  $("mount-progress").replaceChildren(section);
}

function draftFromTask(task) {
  const due = parseISODate(task.due) ? task.due : "";
  const dueMonth = task.dueMonth && /^\d{4}-\d{2}$/.test(task.dueMonth) ? task.dueMonth : "";
  let duePrecision = "none";
  if (due) duePrecision = "day";
  else if (dueMonth) duePrecision = "month";
  return {
    title: task.title || "",
    category: task.category || "",
    phase: task.phase || state.model.phases[0]?.id || "",
    status: task.status || "todo",
    notes: task.notes || "",
    duePrecision,
    due,
    dueMonth,
    vendorTracked: Boolean(task.vendorTracked),
    vendorName: task.vendorName || "",
    vendorPhone: task.vendorPhone || "",
    vendorUrl: task.vendorUrl || "",
    cost: typeof task.cost === "number" ? String(task.cost) : "",
    deposit: typeof task.deposit === "number" ? String(task.deposit) : "",
    balanceDue: parseISODate(task.balanceDue) ? task.balanceDue : "",
    byoAlcohol: task.byoAlcohol || "unknown",
    outsideCatering: task.outsideCatering || "unknown",
  };
}

function newDraft() {
  const category = categoriesInOrder(state.model.tasks)[0] || "General";
  return {
    title: "",
    category,
    phase: state.model.phases[0]?.id || "",
    status: "todo",
    notes: "",
    duePrecision: "none",
    due: "",
    dueMonth: "",
    vendorTracked: categorySuggestsVendor(category),
    vendorName: "",
    vendorPhone: "",
    vendorUrl: "",
    cost: "",
    deposit: "",
    balanceDue: "",
    byoAlcohol: "unknown",
    outsideCatering: "unknown",
  };
}

function readDraftFromForm(form) {
  return {
    title: form.elements.title.value,
    category: form.elements.category.value,
    phase: form.elements.phase.value,
    status: form.elements.status.value,
    notes: form.elements.notes.value,
    duePrecision: form.elements.duePrecision.value,
    due: form.elements.due.value,
    dueMonth: form.elements.dueMonth.value,
    vendorTracked: form.elements.vendorTracked.checked,
    vendorName: form.elements.vendorName.value,
    vendorPhone: form.elements.vendorPhone.value,
    vendorUrl: form.elements.vendorUrl.value,
    cost: form.elements.cost.value,
    deposit: form.elements.deposit.value,
    balanceDue: form.elements.balanceDue.value,
    byoAlcohol: form.elements.byoAlcohol?.value || "unknown",
    outsideCatering: form.elements.outsideCatering?.value || "unknown",
  };
}

function captureDraftFromDom() {
  const form = $("task-editor");
  if (!form || form.dataset.id !== state.editingId) return;
  state.draft = readDraftFromForm(form);
}

function labeledField(label, control, className = "field") {
  return el("label", { class: className }, [
    el("span", { class: "field-label", text: label }),
    control,
  ]);
}

function isVenueCategory(category) {
  return String(category || "").trim().toLowerCase() === "venue";
}

function policySelect(name, labels, value) {
  const select = el("select", { name }, Object.entries(labels).map(([key, label]) => el("option", { value: key, text: label })));
  select.value = Object.prototype.hasOwnProperty.call(labels, value) ? value : "unknown";
  return select;
}

function statusChoices(current) {
  const values = [...STATUS_ORDER];
  if (current === "in-progress") values.splice(1, 0, "in-progress");
  return values;
}

function taskForm(draft, { formId, isNew }) {
  const title = fieldInput("input", {
    id: "edit-title",
    name: "title",
    type: "text",
    required: true,
    maxlength: "180",
    autocomplete: "off",
  }, draft.title);

  const categories = categoriesInOrder(viewTasks());
  if (draft.category && !categories.includes(draft.category)) categories.push(draft.category);
  const category = fieldInput("input", {
    name: "category",
    type: "text",
    list: "category-options",
    autocomplete: "off",
  }, draft.category);
  const dataList = el("datalist", { id: "category-options" }, categories.map((item) => el("option", { value: item })));

  const phases = state.model.phases.map((phase) => el("option", { value: phase.id, text: phase.title }));
  if (draft.phase && !state.model.phases.some((phase) => phase.id === draft.phase)) {
    phases.push(el("option", { value: draft.phase, text: draft.phase }));
  }
  const phase = el("select", { name: "phase" }, phases);
  phase.value = draft.phase;

  const status = el("select", { name: "status" }, statusChoices(draft.status).map((value) => (
    el("option", { value, text: STATUS_LABELS[value] })
  )));
  status.value = statusChoices(draft.status).includes(draft.status) ? draft.status : "todo";

  const precision = (value, label) => {
    const radio = el("input", { type: "radio", name: "duePrecision", value });
    if (draft.duePrecision === value) radio.checked = true;
    return el("label", { class: "choice" }, [radio, label]);
  };

  const vendorToggle = el("input", { type: "checkbox", name: "vendorTracked" });
  vendorToggle.checked = Boolean(draft.vendorTracked);

  const errors = state.formErrors.length
    ? el("div", { class: "form-errors", id: "form-errors", role: "alert", tabIndex: "-1" }, [
      el("strong", { text: "Check this item" }),
      el("ul", {}, state.formErrors.map((error) => el("li", { text: error }))),
    ])
    : null;

  const form = el("form", { class: "task-form", id: "task-editor", autocomplete: "off" }, [
    el("h3", { class: "editor-heading", id: "editor-heading", text: isNew ? "New timeline item" : "Edit item" }),
    errors,
    labeledField("Title", title),
    el("div", { class: "field-row" }, [
      labeledField("Category", el("span", { class: "combo" }, [category, dataList])),
      labeledField("Phase", phase),
    ]),
    labeledField("Status", status),
    el("fieldset", { class: "precision" }, [
      el("legend", { text: "Due / target date" }),
      el("div", { class: "choice-row" }, [
        precision("day", "Exact day"),
        precision("month", "Month"),
        precision("none", "No date"),
      ]),
        el("div", { class: "precision-panel", "data-precision-panel": "day", hidden: draft.duePrecision !== "day" }, [
        fieldInput("input", { name: "due", type: "date", "aria-label": "Target day" }, draft.due),
      ]),
      el("div", { class: "precision-panel", "data-precision-panel": "month", hidden: draft.duePrecision !== "month" }, [
        fieldInput("input", { name: "dueMonth", type: "month", "aria-label": "Target month" }, draft.dueMonth),
      ]),
    ]),
    labeledField("Notes", fieldInput("textarea", { name: "notes", rows: "4" }, draft.notes)),
    el("label", { class: "choice vendor-toggle" }, [
      vendorToggle,
      "Vendor booking",
    ]),
    el("div", { class: "vendor-fields", hidden: !draft.vendorTracked }, [
      labeledField("Vendor / contact name", fieldInput("input", {
        name: "vendorName",
        type: "text",
        autocomplete: "off",
        maxlength: "120",
      }, draft.vendorName)),
      el("fieldset", { class: "contact-fields" }, [
        el("legend", { text: "Phone or website" }),
        el("div", { class: "field-row" }, [
          labeledField("Phone", fieldInput("input", {
            name: "vendorPhone",
            type: "text",
            inputmode: "tel",
            autocomplete: "off",
            maxlength: "40",
            placeholder: "Business line",
          }, draft.vendorPhone)),
          labeledField("Website", fieldInput("input", {
            name: "vendorUrl",
            type: "text",
            inputmode: "url",
            autocomplete: "off",
            maxlength: "300",
            placeholder: "https://",
          }, draft.vendorUrl)),
        ]),
        el("p", { class: "privacy-note", text: "This repo is public. Use a business contact, not a personal number." }),
      ]),
      el("div", { class: "field-row" }, [
        labeledField("Quoted cost", fieldInput("input", {
          name: "cost",
          type: "text",
          inputmode: "decimal",
          autocomplete: "off",
          placeholder: "0",
        }, draft.cost)),
        labeledField("Deposit paid", fieldInput("input", {
          name: "deposit",
          type: "text",
          inputmode: "decimal",
          autocomplete: "off",
          placeholder: "0",
        }, draft.deposit)),
      ]),
      labeledField("Balance due date", fieldInput("input", { name: "balanceDue", type: "date" }, draft.balanceDue)),
    ]),
    el("fieldset", { class: "venue-policies", hidden: !isVenueCategory(draft.category) }, [
      el("legend", { text: "Venue rules" }),
      el("div", { class: "field-row" }, [
        labeledField("Alcohol", policySelect("byoAlcohol", ALCOHOL_POLICIES, draft.byoAlcohol || "unknown")),
        labeledField("Outside catering", policySelect("outsideCatering", CATERING_POLICIES, draft.outsideCatering || "unknown")),
      ]),
      el("p", { class: "privacy-note", text: "These match the shortlist badges. Unknown is fine until the venue confirms the rule." }),
    ]),
    el("p", { class: "editor-note", text: "Saved on this device until you send updates." }),
    el("div", { class: "form-actions" }, [
      el("button", { type: "submit", class: "primary", text: "Save" }),
      el("button", { type: "button", "data-action": "cancel", text: "Cancel" }),
      isNew ? null : el("button", { type: "button", class: "danger", "data-action": "delete", text: "Delete" }),
    ]),
  ]);
  form.dataset.id = formId;
  form.noValidate = true;
  bindEditor(form, { isNew });
  return form;
}

function bindEditor(form, { isNew }) {
  const syncPrecision = () => {
    const value = form.elements.duePrecision.value || "none";
    for (const panel of form.querySelectorAll("[data-precision-panel]")) {
      panel.hidden = panel.getAttribute("data-precision-panel") !== value;
    }
  };
  const radios = form.elements.duePrecision;
  [...radios].forEach((radio) => radio.addEventListener("change", syncPrecision));
  const vendorFields = form.querySelector(".vendor-fields");
  const syncVendor = () => {
    vendorFields.hidden = !form.elements.vendorTracked.checked;
  };
  form.elements.vendorTracked.addEventListener("change", () => {
    form.dataset.vendorTouched = "yes";
    syncVendor();
  });
  const syncVenuePolicy = () => {
    const panel = form.querySelector(".venue-policies");
    if (panel) panel.hidden = !isVenueCategory(form.elements.category.value);
  };
  form.elements.category.addEventListener("input", syncVenuePolicy);
  form.elements.category.addEventListener("change", () => {
    syncVenuePolicy();
    if (!isNew || form.dataset.vendorTouched === "yes") return;
    form.elements.vendorTracked.checked = categorySuggestsVendor(form.elements.category.value.trim());
    syncVendor();
  });
  syncVenuePolicy();
  form.addEventListener("input", () => {
    state.formErrors = [];
    form.querySelector(".form-errors")?.remove();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditor(form, { isNew });
  });
  form.querySelector("[data-action=cancel]").addEventListener("click", () => {
    const focusId = !isNew && state.editingId ? `edit-${state.editingId}` : "add-item";
    state.editingId = null;
    state.formErrors = [];
    render({ focusId });
  });
  form.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    const task = viewTasks().find((item) => item.id === state.editingId);
    if (task) deleteTask(task);
  });
}

function takenIds() {
  return new Set([...state.model.tasks.map((task) => task.id), ...Object.keys(state.edits)]);
}

function saveEditor(form, { isNew }) {
  const draft = readDraftFromForm(form);
  state.draft = draft;
  const { errors, snapshot } = snapshotFromDraft(draft);
  if (errors.length) {
    state.formErrors = errors;
    render({ focusId: "form-errors", reveal: true });
    return;
  }
  state.formErrors = [];
  if (isNew) {
    const id = slugTaskId(snapshot.title, takenIds());
    state.edits[id] = serializeAdd(id, snapshot);
    state.editingId = null;
    saveEdits(state.edits);
    render({ focusId: `edit-${id}`, reveal: true });
    return;
  }
  const id = state.editingId;
  const current = viewTasks().find((task) => task.id === id);
  if (current?.local === "added") {
    state.edits[id] = serializeAdd(id, snapshot);
  } else {
    const baseline = baselineTask(id);
    const patch = diffTask(baseline, snapshot);
    if (Object.keys(patch).length) state.edits[id] = patch;
    else delete state.edits[id];
  }
  state.editingId = null;
  saveEdits(state.edits);
  render({ focusId: `edit-${id}`, reveal: true });
}

function openEditor(task) {
  state.editingId = task.id;
  state.draft = draftFromTask(task);
  state.formErrors = [];
  render({ focusId: "edit-title", reveal: true });
}

function openNewItem() {
  state.editingId = NEW_ITEM;
  state.draft = newDraft();
  state.formErrors = [];
  render({ focusId: "edit-title", reveal: true });
}

function commitSnapshot(task, snapshot) {
  if (task.local === "added") {
    state.edits[task.id] = serializeAdd(task.id, snapshot);
  } else {
    const baseline = baselineTask(task.id);
    const patch = diffTask(baseline, { ...taskSnapshot(task), ...snapshot });
    if (Object.keys(patch).length) state.edits[task.id] = patch;
    else delete state.edits[task.id];
  }
  saveEdits(state.edits);
}

function toggleDone(task) {
  const baseline = baselineTask(task.id);
  const nextStatus = statusAfterMarkDone(task.status, task.local === "added" ? "todo" : baseline?.status);
  const snapshot = taskSnapshot(task);
  snapshot.status = nextStatus;
  commitSnapshot(task, snapshot);
  render({ focusId: `done-${task.id}` });
}

function deleteTask(task) {
  const confirmed = window.confirm(`Delete “${task.title}”? This stays on this device until you send updates or reset local edits.`);
  if (!confirmed) return;
  if (task.local === "added") delete state.edits[task.id];
  else state.edits[task.id] = { _op: "delete" };
  if (state.editingId === task.id) state.editingId = null;
  state.formErrors = [];
  saveEdits(state.edits);
  render({ focusId: "add-item" });
}

function undoDelete(id) {
  delete state.edits[id];
  saveEdits(state.edits);
  render({ focusId: `edit-${id}`, reveal: true });
}

function resetEdits() {
  if (!usingEdits()) return;
  const confirmed = window.confirm("Clear every local edit on this device? data/wedding.json stays the same.");
  if (!confirmed) return;
  state.edits = {};
  state.guestEdits = null;
  state.quotes = {};
  state.actionChecks = {};
  state.cateringUnit = "per-table";
  state.openQuoteId = null;
  state.quoteError = null;
  state.editingId = null;
  state.formErrors = [];
  state.issue = null;
  saveEdits(state.edits);
  saveGuestEdits(null);
  writeJsonStorage(QUOTE_KEY, null);
  writeJsonStorage(ACTION_KEY, null);
  writeJsonStorage(UNIT_KEY, null);
  render({ focusId: "send-updates" });
}

function externalLink(href, text) {
  return el("a", { href, target: "_blank", rel: "noopener noreferrer" }, [
    text,
    el("span", { class: "sr-only", text: " (opens in a new tab)" }),
  ]);
}

function detailList(task) {
  const rows = [];
  if (task.vendorTracked) {
    const href = safeHttpUrl(task.vendorUrl);
    rows.push(["Vendor", task.vendorName || "Not chosen yet"]);
    if (task.vendorPhone) rows.push(["Phone", task.vendorPhone]);
    if (task.vendorUrl) rows.push(["Website", href ? externalLink(href, task.vendorUrl) : task.vendorUrl]);
    if (typeof task.cost === "number") rows.push(["Quoted cost", formatMoney(task.cost, currency())]);
    if (typeof task.deposit === "number") rows.push(["Deposit paid", formatMoney(task.deposit, currency())]);
    const balance = parseISODate(task.balanceDue);
    if (balance) rows.push(["Balance due", formatLongDate(balance)]);
  }
  if (isVenueCategory(task.category)) {
    if (task.byoAlcohol) rows.push(["Alcohol", ALCOHOL_POLICIES[task.byoAlcohol] || task.byoAlcohol]);
    if (task.outsideCatering) rows.push(["Catering", CATERING_POLICIES[task.outsideCatering] || task.outsideCatering]);
  }
  const shortlist = (state.model.vendorOptions || []).filter((vendor) => vendor.taskId === task.id);
  if (shortlist.length) {
    const shown = shortlist.slice(0, 3);
    const more = shortlist.length - shown.length;
    rows.push(["Shortlist", el("span", {}, [
      ...shown.flatMap((vendor, index) => [
        index ? ", " : "",
        vendor.url ? externalLink(vendor.url, vendor.name) : vendor.name,
      ]),
      more ? ` +${more} more` : "",
    ])]);
  }
  if (!rows.length) return null;
  return el("dl", { class: "details" }, rows.flatMap(([label, value]) => [
    el("dt", { text: label }),
    el("dd", {}, [value]),
  ]));
}

function taskArticle(task, today) {
  if (state.editingId === task.id) {
    return el("article", { class: "task is-editing", id: `task-${task.id}`, "aria-labelledby": "editor-heading" }, [
      taskForm(state.draft || draftFromTask(task), { formId: task.id, isNew: false }),
    ]);
  }

  const overdue = isOverdue(task, task.status, today);
  const classes = ["task"];
  if (isCompleteStatus(task.status)) classes.push("is-done");
  else if (isUnderwayStatus(task.status)) classes.push("is-progress");
  if (overdue) classes.push("is-overdue");

  const titleId = `task-title-${task.id}`;
  const badges = [badge(task.status)];
  if (overdue) badges.push(el("span", { class: "badge badge-overdue", text: "Overdue" }));
  if (task.local === "added") {
    badges.push(el("span", { class: "badge badge-unsent", title: "Saved in this browser, not sent yet", text: "New" }));
  } else if (task.local === "edited") {
    badges.push(el("span", { class: "badge badge-unsent", title: "Saved in this browser, not sent yet", text: "Unsent" }));
  }

  const due = resolveDue(task);
  const phrase = taskDuePhrase(task, today);
  const editId = `edit-${task.id}`;
  const editButton = el("button", { type: "button", class: "icon-button", id: editId }, [pencilIcon(), "Edit"]);
  editButton.setAttribute("aria-label", `Edit ${task.title}`);
  editButton.addEventListener("click", () => openEditor(task));

  const deleteButton = el("button", { type: "button", class: "danger text-button", text: "Delete" });
  deleteButton.addEventListener("click", () => deleteTask(task));

  const doneId = `done-${task.id}`;
  const doneBox = el("input", { id: doneId, type: "checkbox", "aria-describedby": "edit-hint" });
  doneBox.checked = task.status === "done";
  doneBox.addEventListener("change", () => toggleDone(task));

  return el("article", { class: classes.join(" "), id: `task-${task.id}`, "aria-labelledby": titleId }, [
    el("div", { class: "task-top" }, [
      el("div", {}, [
        el("p", { class: "kicker", text: task.category }),
        el("h4", { id: titleId, text: task.title }),
      ]),
      el("div", { class: "task-tools" }, [
        el("div", { class: "badges" }, badges),
        el("div", { class: "task-actions" }, [editButton, deleteButton]),
      ]),
    ]),
    el("p", { class: "due" }, [
      el("span", { class: "sr-only", text: "Due date: " }),
      due ? el("time", { datetime: due.iso, text: formatDue(task) }) : "No due date",
      phrase ? el("span", { class: "due-count", text: phrase }) : null,
    ]),
    task.notes ? el("p", { class: "notes" }, richText(task.notes)) : null,
    detailList(task),
    el("label", { class: "check-label", for: doneId }, [doneBox, "Mark done"]),
  ]);
}

function renderTasks() {
  const tasks = viewTasks();
  const { phases } = state.model;
  const categories = categoriesInOrder(tasks);
  if (state.categoryFilter !== "all" && !categories.includes(state.categoryFilter)) {
    state.categoryFilter = "all";
  }

  const counts = { all: tasks.length };
  for (const status of [...STATUS_ORDER, "in-progress"]) {
    counts[status] = tasks.filter((task) => task.status === status).length;
  }
  const statusValues = [...STATUS_ORDER];
  if (counts["in-progress"] || state.statusFilter === "in-progress") statusValues.splice(1, 0, "in-progress");

  const statusSelect = el("select", { id: "filter-status" }, [
    el("option", { value: "all", text: `All (${counts.all})` }),
    ...statusValues.map((status) => el("option", { value: status, text: `${STATUS_LABELS[status]} (${counts[status]})` })),
  ]);
  statusSelect.value = state.statusFilter;
  statusSelect.addEventListener("change", () => {
    state.statusFilter = statusSelect.value;
    render({ focusId: "filter-status" });
  });

  const categorySelect = el("select", { id: "filter-category" }, [
    el("option", { value: "all", text: "All categories" }),
    ...categories.map((category) => el("option", { value: category, text: category })),
  ]);
  categorySelect.value = state.categoryFilter;
  categorySelect.addEventListener("change", () => {
    state.categoryFilter = categorySelect.value;
    render({ focusId: "filter-category" });
  });

  const visible = tasks.filter((task) => {
    if (task.id === state.editingId) return true;
    if (state.statusFilter !== "all" && task.status !== state.statusFilter) return false;
    if (state.categoryFilter !== "all" && task.category !== state.categoryFilter) return false;
    return true;
  });
  const visibleIds = new Set(visible.map((task) => task.id));
  const filtering = state.statusFilter !== "all" || state.categoryFilter !== "all";
  const today = startOfToday();

  const groups = groupByPhase(tasks, phases)
    .map((group) => ({
      phase: group.phase,
      allTasks: group.tasks,
      tasks: group.tasks.filter((task) => visibleIds.has(task.id)),
    }))
    .filter((group) => group.tasks.length > 0);

  const phaseNodes = groups.map((group) => {
    const stats = progressStats(group.allTasks, (task) => task.status);
    const countText = filtering ? `${group.tasks.length} shown` : `${stats.done} / ${stats.total} complete`;
    return el("section", { class: "phase", "aria-labelledby": `phase-${group.phase.id}` }, [
      el("div", { class: "phase-head" }, [
        el("h3", { id: `phase-${group.phase.id}`, text: group.phase.title }),
        el("p", { class: "phase-count", text: countText }),
      ]),
      group.phase.summary ? el("p", { class: "phase-summary", text: group.phase.summary }) : null,
      el("div", { class: "phase-tasks" }, group.tasks.map((task) => taskArticle(task, today))),
    ]);
  });

  const deleted = Object.entries(state.edits)
    .filter(([, patch]) => patch?._op === "delete")
    .map(([id]) => ({ id, title: baselineTask(id)?.title || id }));

  const deletedNote = deleted.length
    ? el("div", { class: "deleted-list" }, [
      el("p", { text: deleted.length === 1 ? "Removed on this device:" : "Removed on this device:" }),
      el("ul", {}, deleted.map((item) => {
        const undo = el("button", { type: "button", text: "Undo" });
        undo.addEventListener("click", () => undoDelete(item.id));
        return el("li", {}, [item.title, undo]);
      })),
    ])
    : null;

  const editor = state.editingId === NEW_ITEM
    ? el("article", { class: "task is-editing editor-card", "aria-labelledby": "editor-heading" }, [
      el("p", { class: "kicker", text: "New item" }),
      taskForm(state.draft || newDraft(), { formId: NEW_ITEM, isNew: true }),
    ])
    : null;

  const addButton = el("button", { type: "button", id: "add-item", text: "Add item" });
  addButton.addEventListener("click", openNewItem);

  const section = el("section", { class: "section", id: "timeline", "aria-labelledby": "timeline-heading" }, [
    el("div", { class: "section-head" }, [
      el("h2", { id: "timeline-heading", text: "Timeline" }),
      el("div", { class: "section-actions" }, [
        sendButton("send-updates-timeline"),
        addButton,
        usingEdits() ? resetButton("reset-edits") : null,
      ]),
    ]),
    el("div", { class: "filters" }, [
      el("label", { class: "filter", for: "filter-status" }, ["Status", statusSelect]),
      el("label", { class: "filter", for: "filter-category" }, ["Category", categorySelect]),
      filtering ? el("button", { type: "button", id: "clear-filters", text: "Clear filters" }) : null,
    ]),
    el("p", {
      class: "hint",
      id: "edit-hint",
      text: "Edit an item to change it on this device. Mark done sets the status. Send updates opens a GitHub issue an assistant can apply to data/wedding.json. Items with a dashed badge have unsent edits.",
    }),
    el("p", { class: "showing", text: filtering ? `Showing ${visible.length} of ${tasks.length} tasks` : `${tasks.length} tasks` }),
    deletedNote,
    editor,
    visible.length
      ? el("div", { class: "timeline" }, phaseNodes)
      : el("p", { class: "empty", text: editor ? "No other tasks match this filter." : "No tasks match this filter." }),
  ]);

  $("mount-timeline").replaceChildren(section);
  $("clear-filters")?.addEventListener("click", () => {
    state.statusFilter = "all";
    state.categoryFilter = "all";
    render({ focusId: "filter-status" });
  });
}

function renderVendors() {
  const tasks = viewTasks();
  const rows = tasks.filter((task) => task.vendorTracked);
  const costs = knownCostTotal(tasks);
  const blank = costs.tracked - costs.known;
  const totalText = costs.known === 0 ? "No costs entered yet" : formatMoney(costs.total, currency());
  const note = costs.known === 0
    ? "Add a quoted cost when you know it."
    : `${costs.known} cost${costs.known === 1 ? "" : "s"} entered · ${blank} still blank`;
  const counts = editCounts(state.edits);

  const body = rows.map((task) => {
    const href = safeHttpUrl(task.vendorUrl);
    const name = task.vendorName || "Not chosen yet";
    const vendorCell = el("div", { class: "vendor-cell" }, [
      href ? externalLink(href, name) : name,
      task.vendorPhone ? el("span", { class: "vendor-meta", text: task.vendorPhone }) : null,
    ]);
    const costCell = el("div", {}, [
      typeof task.cost === "number" ? formatMoney(task.cost, currency()) : "—",
      typeof task.deposit === "number"
        ? el("span", { class: "deposit-note", text: `Deposit ${formatMoney(task.deposit, currency())}` })
        : null,
    ]);
    return el("tr", {}, [
      el("td", { "data-label": "Booking", text: task.title }),
      el("td", { class: "vendor", "data-label": "Vendor" }, [vendorCell]),
      el("td", { class: "num", "data-label": "Cost" }, [costCell]),
      el("td", { "data-label": "Status", text: STATUS_LABELS[task.status] || STATUS_LABELS.todo }),
    ]);
  });

  const caption = counts.total
    ? "Bookings with vendor details. Status and costs include unsent edits on this device. Blank costs are left out of the total."
    : "Bookings with vendor details from data/wedding.json. Blank costs are left out of the total.";

  const table = el("table", {}, [
    el("caption", { text: caption }),
    el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col", text: "Booking" }),
        el("th", { scope: "col", text: "Vendor" }),
        el("th", { scope: "col", class: "num", text: `Cost (${currency()})` }),
        el("th", { scope: "col", text: "Status" }),
      ]),
    ]),
    el("tbody", {}, body.length ? body : [el("tr", {}, [el("td", { colspan: "4", text: "No vendor bookings yet. Edit an item and turn on Vendor booking." })])]),
    el("tfoot", {}, [
      el("tr", {}, [
        el("th", { scope: "row", text: "Known costs" }),
        el("td", { "data-label": "Bookings", text: `${costs.tracked} booking${costs.tracked === 1 ? "" : "s"}` }),
        el("td", { class: "num", "data-label": "Total", id: "cost-total", text: totalText }),
        el("td", { "data-label": "Note", text: note }),
      ]),
    ]),
  ]);

  const section = el("section", { class: "section", id: "vendors", "aria-labelledby": "vendors-heading" }, [
    el("h2", { id: "vendors-heading", text: "Vendors" }),
    el("h3", { class: "subhead", text: "Bookings" }),
    el("div", { class: "table-scroll" }, [table]),
    renderWeddingParty(),
    renderBudget(),
    renderShortlist(),
  ]);
  $("mount-vendors").replaceChildren(section);
}

function sourceList(sources) {
  if (!sources?.length) return null;
  return el("span", { class: "sources" }, [
    "Source: ",
    ...sources.flatMap((source, index) => [index ? " · " : "", externalLink(source.url, source.label)]),
  ]);
}

function moneyRange(range) {
  const code = currency();
  if (!range) return "—";
  if (range.low === range.high) return formatMoney(range.low, code);
  return `${formatMoney(range.low, code)} – ${formatMoney(range.high, code)}`;
}

function policyBadges(vendor) {
  if (!vendor.byoAlcohol && !vendor.outsideCatering) return null;
  const bits = [];
  if (vendor.byoAlcohol) bits.push(el("span", { class: `pill pill-policy pill-${vendor.byoAlcohol}`, text: ALCOHOL_POLICIES[vendor.byoAlcohol] }));
  if (vendor.outsideCatering) bits.push(el("span", { class: `pill pill-policy pill-${vendor.outsideCatering}`, text: CATERING_POLICIES[vendor.outsideCatering] }));
  return el("p", { class: "policy-badges" }, bits.flatMap((node, index) => [index ? " " : "", node]));
}

function renderWeddingParty() {
  const party = state.model.weddingParty;
  if (!party) return null;
  const facts = [];
  if (party.bridesmaids != null) facts.push(["Bridesmaids", formatNumber(party.bridesmaids)]);
  if (party.groomsmen != null) facts.push(["Groomsmen", formatNumber(party.groomsmen)]);
  for (const trays of party.teaCeremonyTrays) {
    const extra = extraTrayCarriers(party, trays);
    facts.push([`${trays} trays`, extra ? `+${extra} per side` : "Covered"]);
  }
  return el("div", { class: "panel party-panel" }, [
    el("h3", { class: "subhead", text: "Wedding party and tray carriers" }),
    el("dl", { class: "party-facts" }, facts.map(([term, value]) => el("div", {}, [
      el("dt", { text: term }),
      el("dd", { text: value }),
    ]))),
    party.summary ? el("p", {}, richText(party.summary)) : null,
    party.sources.length ? el("p", { class: "hint" }, [sourceList(party.sources)]) : null,
  ]);
}

function budgetCounts() {
  const budget = state.model.budget;
  const primary = state.model.settings.guestCount;
  const counts = [];
  if (typeof primary === "number" && Number.isFinite(primary) && primary > 0) counts.push(primary);
  for (const count of budget?.guestCounts || []) {
    if (!counts.includes(count)) counts.push(count);
  }
  const tail = counts.slice(1).sort((a, b) => a - b);
  return counts.length ? [counts[0], ...tail] : tail;
}

function compareToTarget(total, target) {
  if (!total || typeof target !== "number") return "";
  if (total.high < target) return `under ${formatMoney(target, currency())}`;
  if (total.low > target) return `over ${formatMoney(target, currency())}`;
  return `spans ${formatMoney(target, currency())}`;
}

function renderBudget() {
  const budget = state.model.budget;
  if (!budget || !budget.lines.length) return null;
  const counts = budgetCounts();
  const setGuests = state.model.settings.guestCount;
  const countLabel = (n) => (n === setGuests ? `${formatNumber(n)} guests (baseline)` : `${formatNumber(n)} guests`);
  const quoteByTask = currentQuoteMap();
  const totals = counts.map((n) => budgetTotals(budget, n, quoteByTask));
  const target = budget.target ?? state.model.settings.budget;

  const rows = [];
  for (const [group, groupLabel] of Object.entries(BUDGET_GROUPS)) {
    const lines = budget.lines.filter((line) => line.group === group);
    if (!lines.length) continue;
    rows.push(el("tr", { class: "group-row" }, [
      el("th", { scope: "colgroup", colspan: String(counts.length + 2), text: groupLabel }),
    ]));
    for (const line of lines) {
      rows.push(el("tr", {}, [
        el("td", { "data-label": "Item" }, [
          el("span", { class: "line-item" }, richText(line.item)),
          " ",
          el("span", { class: `pill pill-${line.priceType}`, text: line.priceType === "listed" ? "Listed" : "Estimate" }),
          line.feesIncluded ? el("span", { class: "pill pill-listed", text: "Fees included" }) : null,
        ]),
        ...counts.map((n) => {
          const cost = lineCost(line, n, quoteByTask);
          return el("td", { class: "num", "data-label": countLabel(n) }, [
            cost.quoted ? el("span", { class: "pill pill-quote", text: "Quote" }) : null,
            " ",
            moneyRange(cost),
          ]);
        }),
        el("td", { class: "basis", "data-label": "Basis" }, [
          el("span", {}, richText(line.basis)),
          line.notes ? el("span", { class: "line-note" }, richText(line.notes)) : null,
          sourceList(line.sources),
        ]),
      ]));
    }
    if (group === "wedding") {
      const pct = budget.contingencyPercent;
      rows.push(el("tr", { class: "subtotal-row" }, [
        el("td", { "data-label": "Item", text: "Subtotal" }),
        ...totals.map((total, index) => el("td", { class: "num", "data-label": countLabel(counts[index]), text: moneyRange(total.groups.wedding) })),
        el("td", { class: "basis", "data-label": "Basis", text: "Wedding-day lines only. Optional lines and the two parties are not included." }),
      ]));
      rows.push(el("tr", { class: "subtotal-row" }, [
        el("td", { "data-label": "Item", text: `Tax, tips, and fees (${pct.low}–${pct.high}%)` }),
        ...totals.map((total, index) => el("td", { class: "num", "data-label": countLabel(counts[index]), text: moneyRange(total.contingency) })),
        el("td", { class: "basis", "data-label": "Basis", text: "Applied only to wedding-day lines that do not already include service and tax. Lines marked Fees included, including the Vietnamese dinner, are left out." }),
      ]));
    }
  }

  const table = el("table", { class: "budget-table" }, [
    el("caption", { text: budget.summary }),
    el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col", text: "Item" }),
        ...counts.map((n) => el("th", { scope: "col", class: "num", text: countLabel(n) })),
        el("th", { scope: "col", text: "Basis" }),
      ]),
    ]),
    el("tbody", {}, rows),
    el("tfoot", {}, [
      el("tr", {}, [
        el("th", { scope: "row", text: "Wedding total" }),
        ...totals.map((total, index) => el("td", { class: "num", "data-label": countLabel(counts[index]) }, [
          el("strong", { text: moneyRange(total.wedding) }),
          total.perGuest ? el("span", { class: "per-guest", text: `${moneyRange(total.perGuest)} per guest` }) : null,
          typeof target === "number" ? el("span", { class: targetClass(total.wedding, target), text: compareToTarget(total.wedding, target) }) : null,
        ])),
        el("td", { "data-label": "Note", text: "Excludes optional lines and bachelor or bachelorette costs. Both bar options are inside this range." }),
      ]),
    ]),
  ]);

  return el("div", { class: "budget-block", id: "budget-estimate" }, [
    el("h3", { class: "subhead", text: "Budget estimate" }),
    el("p", { class: "hint", text: `Ranges for ${counts.map(formatNumber).join(" and ")} guests${budget.asOf ? `, checked ${budget.asOf}` : ""}. Listed means a vendor or directory published the number. Everything else is an estimate.` }),
    renderTargetComparison(budget, totals, counts),
    renderUnitScenarios(budget),
    renderPlan(budget),
    el("div", { class: "table-scroll" }, [table]),
  ]);
}

function targetClass(total, target) {
  if (total.low > target) return "per-guest over-flag";
  if (total.high < target) return "per-guest under-flag";
  return "per-guest";
}

function renderTargetComparison(budget, totals, counts) {
  const target = budget.target ?? state.model.settings.budget;
  if (typeof target !== "number") return null;
  const ceilings = (budget.ceilings?.length ? budget.ceilings : [175, 200, 250]).map((guests) => {
    const ceiling = perGuestCeiling(target, guests);
    return `${formatNumber(guests)} guests: ${formatMoney(ceiling, currency())} per guest`;
  });
  const compare = counts.map((guests, index) => {
    const total = totals[index].wedding;
    return `${formatNumber(guests)} guests ${moneyRange(total)} (${compareToTarget(total, target)})`;
  });
  return el("div", { class: "panel target-panel" }, [
    el("h3", { class: "subhead", text: `Target ${formatMoney(target, currency())}` }),
    el("p", {}, compare.join(". ") + "."),
    el("p", { class: "hint", text: `Per-guest ceiling if the whole target is spent on the wedding: ${ceilings.join("; ")}.` }),
    renderFit(budget, target),
  ]);
}

function renderFit(budget, target) {
  const guests = state.model.settings.guestCount;
  if (typeof guests !== "number" || typeof target !== "number") return null;
  const planOptions = { quoteByTask: currentQuoteMap(), scenario: currentScenario() };
  const fit = fitReport(budget, guests, target, planOptions);
  const levers = budget.levers || [];
  const verdict = fit.planFitsHigh
    ? `The cost-saving plan at ${formatNumber(guests)} guests fits under ${formatMoney(target, currency())} even with the higher bar and the 15% allowance.`
    : `The cost-saving plan at ${formatNumber(guests)} guests is still over ${formatMoney(target, currency())} on the high allowance.`;
  const range = fit.estimateFitsHigh
    ? `The full researched range also fits.`
    : fit.estimateFitsLow
      ? `The full researched range runs ${moneyRange(fit.estimate)}, so only the low end fits. The high end is the gap.`
      : `The full researched range runs ${moneyRange(fit.estimate)}, over the target at both ends.`;
  const checks = [175, 200, 250].map((count) => {
    const total = budgetTotals(budget, count, planOptions.quoteByTask).wedding;
    return `${formatNumber(count)} guests ${moneyRange(total)}`;
  });
  const bars = (planTotals(budget, planOptions)?.options || [])
    .map((option) => `${option.label} ${moneyRange(option.total)}`);
  return el("div", {}, [
    el("p", {}, [el("strong", { text: verdict }), " ", range]),
    el("p", { class: "hint", text: `Researched total after the corrected allowance: ${checks.join("; ")}.` }),
    bars.length ? el("p", { class: "hint", text: `200-guest plan, both bar paths: ${bars.join("; ")}.` }) : null,
    levers.length ? el("ul", { class: "guide-list" }, levers.map((line) => el("li", { text: line }))) : null,
  ]);
}

function renderUnitScenarios(budget) {
  const scenarios = budget.plan?.unitScenarios || [];
  if (scenarios.length < 2) return null;
  const selectedId = currentScenario()?.id || scenarios[0].id;
  const quoted = Boolean(currentQuoteMap()[budget.lines.find((line) => line.id === "catering")?.taskId]);
  const cards = scenarios.map((scenario) => {
    const totals = planTotals(budget, { scenario });
    const selected = scenario.id === selectedId;
    const input = el("input", {
      type: "radio",
      name: "catering-unit",
      value: scenario.id,
      id: `unit-${scenario.id}`,
    });
    input.checked = selected;
    return el("div", { class: selected ? "scenario scenario-selected" : "scenario" }, [
      el("label", { for: `unit-${scenario.id}` }, [input, el("span", { text: scenario.label })]),
      el("p", { text: scenario.detail }),
      el("p", {}, [el("strong", { text: formatMoney(scenario.amount, currency()) }), " catering"]),
      ...(totals?.options || []).map((option) => el("p", { class: "hint", text: `${option.label}: ${moneyRange(option.total)}` })),
    ]);
  });
  const fieldset = el("fieldset", { class: "scenario-grid" }, [
    el("legend", { text: "Per person or per table" }),
    el("p", { class: "hint", text: quoted
      ? "Both published readings stay visible. A received catering quote replaces the selected one in the plan total."
      : "Kim Sơn’s menu does not say which unit the preset uses. Both readings are priced at 200 guests. The plan below follows the one you select." }),
    ...cards,
  ]);
  fieldset.addEventListener("change", (event) => {
    if (event.target?.name !== "catering-unit") return;
    state.cateringUnit = event.target.value;
    writeJsonStorage(UNIT_KEY, state.cateringUnit === "per-table" ? null : { id: state.cateringUnit });
    render({ focusId: event.target.id });
  });
  return fieldset;
}

function planRowFlag(line) {
  if (line.used.low > line.estimate.high) return "above";
  if (line.estimate.low > line.used.high) return "over";
  if (line.used.low > line.estimate.low && line.estimate.high > line.used.low) return "high";
  return "";
}

function renderPlan(budget) {
  const plan = budget.plan;
  const totals = planTotals(budget, { quoteByTask: currentQuoteMap(), scenario: currentScenario() });
  if (!plan || !totals) return null;
  const target = budget.target ?? state.model.settings.budget;
  const rows = totals.rows.map((line) => {
    const flag = planRowFlag(line);
    const amount = line.used.low === line.used.high ? formatMoney(line.used.low, currency()) : moneyRange(line.used);
    return el("tr", { class: flag ? "over-row" : "" }, [
      el("td", { "data-label": "Item" }, [
        line.item,
        " ",
        el("span", { class: `pill pill-${line.priceType}`, text: line.priceType === "listed" ? "Listed" : "Estimate" }),
        line.feesIncluded ? el("span", { class: "pill pill-listed", text: "Fees included" }) : null,
        line.origin === "quote" ? el("span", { class: "pill pill-quote", text: "Quote" }) : null,
        flag === "over" ? el("span", { class: "pill pill-over", text: "Over allocation" }) : null,
        flag === "high" ? el("span", { class: "pill pill-over", text: "High end over" }) : null,
        flag === "above" ? el("span", { class: "pill pill-over", text: "Above researched range" }) : null,
      ]),
      el("td", { class: "num", "data-label": "Plan", text: amount }),
      el("td", { class: "num", "data-label": "Estimate at this count", text: moneyRange(line.estimate) }),
      el("td", { class: "basis", "data-label": "Choice", text: line.choice }),
    ]);
  });
  const optionRows = totals.options.map((option) => {
    const cautious = option.id === totals.cautious?.id;
    return el("tr", { class: cautious ? "subtotal-row" : "" }, [
      el("td", { "data-label": "Bar option" }, [
        option.label,
        " ",
        el("span", { class: `pill pill-${option.quoted ? "quote" : "estimate"}`, text: option.quoted ? "Quote" : "Estimate" }),
        cautious ? el("span", { class: "pill pill-over", text: "Higher option" }) : null,
      ]),
      el("td", { class: "num", "data-label": "Plan", text: formatMoney(option.amount, currency()) }),
      el("td", { class: "num", "data-label": "Total with tax and tips", text: moneyRange(option.total) }),
      el("td", { class: "basis", "data-label": "Basis" }, [
        option.basis,
        typeof target === "number" ? el("span", { class: "line-note", text: compareToTarget(option.total, target) }) : null,
      ]),
    ]);
  });
  return el("div", { class: "plan-block", id: "plan-50k" }, [
    el("h3", { class: "subhead", text: plan.label }),
    el("p", { class: "hint", text: plan.summary }),
    el("p", { class: "hint", text: `Allocations are for ${formatNumber(plan.guests)} guests. The 10–15% allowance skips lines marked Fees included. A received quote replaces the estimate. A line is marked over when its researched low is already above that allocation.` }),
    el("div", { class: "table-scroll" }, [
      el("table", { class: "budget-table plan-table" }, [
        el("caption", { text: "Plan to hit the target. The two bar totals are separate. The cautious reading is the higher one." }),
        el("thead", {}, [
          el("tr", {}, [
            el("th", { scope: "col", text: "Item" }),
            el("th", { scope: "col", class: "num", text: "Plan" }),
            el("th", { scope: "col", class: "num", text: "Researched range" }),
            el("th", { scope: "col", text: "Why this number" }),
          ]),
        ]),
        el("tbody", {}, [
          ...rows,
          el("tr", { class: "group-row" }, [
            el("th", { scope: "colgroup", colspan: "4", text: "Bar, two options — not added together" }),
          ]),
          ...optionRows,
        ]),
      ]),
    ]),
  ]);
}

function renderQuoteEditor(vendor) {
  const quote = savedQuotes()[vendor.id] || { amount: null, deposit: null, quotedOn: "", holdDeadline: "", notes: "" };
  const details = el("details", { class: "quote-fold", id: `quote-${vendor.id}`, open: state.openQuoteId === vendor.id });
  const summary = el("summary", {
    text: quote.amount != null ? `Quote received ${formatMoney(quote.amount, currency())}` : "Add a quote",
  });
  const amount = fieldInput("input", { type: "text", inputmode: "decimal", name: "amount", autocomplete: "off" }, quote.amount == null ? "" : String(quote.amount));
  const quotedOn = fieldInput("input", { type: "date", name: "quotedOn" }, quote.quotedOn || "");
  const deposit = fieldInput("input", { type: "text", inputmode: "decimal", name: "deposit", autocomplete: "off" }, quote.deposit == null ? "" : String(quote.deposit));
  const hold = fieldInput("input", { type: "date", name: "holdDeadline" }, quote.holdDeadline || "");
  const notes = fieldInput("textarea", { name: "notes", rows: "2" }, quote.notes || "");
  const form = el("form", { class: "quote-form" }, [
    labeled("Quote amount", amount),
    labeled("Date", quotedOn),
    labeled("Deposit", deposit),
    labeled("Hold deadline", hold),
    labeled("Notes", notes),
    state.quoteError?.id === vendor.id
      ? el("ul", { class: "form-errors" }, state.quoteError.messages.map((message) => el("li", { text: message })))
      : null,
    el("div", { class: "form-actions" }, [
      el("button", { type: "submit", text: "Save quote" }),
      el("button", { type: "button", class: "text-button", text: "Clear quote" }),
    ]),
  ]);
  form.querySelector("button.text-button").addEventListener("click", () => {
    const next = { ...state.quotes };
    delete next[vendor.id];
    state.quotes = next;
    state.quoteError = null;
    state.openQuoteId = vendor.id;
    writeJsonStorage(QUOTE_KEY, Object.keys(savedQuotes()).length ? savedQuotes() : null);
    render({ focusId: `quote-${vendor.id}` });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const amountResult = parseMoneyInput(amount.value);
    const depositResult = parseMoneyInput(deposit.value);
    const messages = [];
    if (!amountResult.ok) messages.push("Quote amount needs to be a number, or blank.");
    if (!depositResult.ok) messages.push("Deposit needs to be a number, or blank.");
    if (quotedOn.value && !parseISODate(quotedOn.value)) messages.push("Date needs to be a real day.");
    if (hold.value && !parseISODate(hold.value)) messages.push("Hold deadline needs to be a real day.");
    if (messages.length) {
      state.quoteError = { id: vendor.id, messages };
      state.openQuoteId = vendor.id;
      render({ focusId: `quote-${vendor.id}` });
      return;
    }
    const next = normalizeQuotes({
      ...savedQuotes(),
      [vendor.id]: {
        amount: amountResult.amount,
        deposit: depositResult.amount,
        quotedOn: quotedOn.value,
        holdDeadline: hold.value,
        notes: notes.value,
      },
    });
    state.quotes = next;
    state.quoteError = null;
    state.openQuoteId = vendor.id;
    writeJsonStorage(QUOTE_KEY, Object.keys(next).length ? next : null);
    render({ focusId: `quote-${vendor.id}` });
  });
  details.append(summary, form);
  return details;
}

function labeled(text, control) {
  const id = `field-${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return el("label", { class: "field", for: id }, [
    el("span", { class: "field-label", text }),
    control,
  ]);
}

function renderShortlist() {
  const vendors = state.model.vendorOptions;
  if (!vendors?.length) return null;
  const titles = new Map(state.model.tasks.map((task) => [task.id, task.title]));
  const groups = groupVendorOptions(vendors);
  const blocks = groups.map((group) => el("details", {
    class: "shortlist-group",
    id: `shortlist-${group.category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    open: group.vendors.some((vendor) => vendor.id === state.openQuoteId),
  }, [
    el("summary", {}, [
      el("span", { text: group.category }),
      el("span", { class: "count", text: String(group.vendors.length) }),
    ]),
    el("ul", { class: "shortlist" }, group.vendors.map((vendor) => el("li", { class: "vendor-card", id: `vendor-option-${vendor.id}` }, [
      el("p", { class: "vendor-name" }, [
        vendor.url ? externalLink(vendor.url, vendor.name) : vendor.name,
        vendor.base ? el("span", { class: "vendor-base", text: vendor.base }) : null,
      ]),
      policyBadges(vendor),
      vendor.pricing ? el("p", { class: "vendor-price" }, [
        el("span", { class: `pill pill-${vendor.priceType === "listed" ? "listed" : "estimate"}`, text: { listed: "Listed", estimate: "Estimate", quote: "Quote" }[vendor.priceType] || "Quote" }),
        " ",
        vendor.pricing,
      ]) : null,
      vendor.fit ? el("p", {}, richText(vendor.fit)) : null,
      vendor.caveat ? el("p", { class: "vendor-caveat" }, [el("strong", { text: "Check: " }), ...richText(vendor.caveat)]) : null,
      el("p", { class: "vendor-meta" }, [
        vendor.taskId && titles.has(vendor.taskId) ? `For: ${titles.get(vendor.taskId)}` : "",
        vendor.policySource ? el("span", { class: "line-note" }, [sourceList([vendor.policySource])]) : null,
        vendor.source ? el("span", { class: "line-note" }, [sourceList([vendor.source])]) : null,
        vendor.email ? el("span", { class: "line-note", text: `Email: ${vendor.email}` }) : null,
        vendor.phone ? el("span", { class: "line-note", text: `Phone: ${vendor.phone}` }) : null,
      ]),
      renderQuoteEditor(vendor),
    ]))),
  ]));
  return el("div", { class: "shortlist-block", id: "vendor-shortlist" }, [
    el("h3", { class: "subhead", text: "Vendor shortlist" }),
    el("p", { class: "hint", text: `${vendors.length} candidates to contact. They are not bookings and they are not in Known costs. Venue cards show alcohol and outside-catering rules when a source states them.` }),
    ...blocks,
  ]);
}

function renderSendMount() {
  const mount = $("mount-send");
  if (!mount) return;
  mount.replaceChildren(sendButton("send-updates"));
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function downloadJson(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openIssuePreview() {
  const updatedOn = formatISO(startOfToday());
  const guestPlan = guestEditsDirty(state.model.guestPlan, state.guestEdits)
    ? applyGuestEdits(state.model.guestPlan, state.guestEdits)
    : null;
  const quotes = quotesDirty() ? savedQuotes() : null;
  const nextActions = actionsDirty()
    ? Object.fromEntries(Object.entries(state.actionChecks).filter(([, checked]) => checked))
    : null;
  const cateringUnit = unitDirty() ? state.cateringUnit : null;
  const payload = buildUpdatePayload(state.model.tasks, state.edits, updatedOn, currency(), state.model.phases, {
    guestPlan,
    quotes,
    nextActions,
    cateringUnit,
  });
  const link = githubIssueUrl({ title: payload.title, body: payload.body });
  state.issue = {
    ...payload,
    ...link,
    opened: false,
    notice: "",
    empty: Object.keys(payload.changes).length === 0 && !guestPlan && !quotes && !nextActions && !cateringUnit,
  };
  render({ focusId: state.issue.empty ? "close-issue" : "open-issue" });
}

function confirmOpenIssue() {
  const issue = state.issue;
  if (!issue || issue.empty) return;
  // A feature string of "noopener" makes some browsers return null even when the tab opens.
  const opened = window.open(issue.url, "_blank");
  try {
    if (opened) opened.opener = null;
  } catch {
    /* The tab can still open when the opener property is sealed. */
  }
  if (issue.tooLong) copyText(issue.json);
  state.issue = {
    ...issue,
    opened: true,
    notice: issue.tooLong
      ? "This update was too long for the GitHub link. The JSON was copied — paste it into the issue that just opened."
      : opened
        ? "GitHub issue draft opened in a new tab. Submit it there, then keep or clear the edits on this device."
        : "The new tab was blocked. Use Copy updates, then open a GitHub issue and paste the text.",
  };
  render({ focusId: "keep-edits" });
}

function closeIssue(focusId = "send-updates") {
  state.issue = null;
  render({ focusId });
}

function renderIssue() {
  const root = $("dialog-root");
  if (!root) return;
  const issue = state.issue;
  if (!issue) {
    root.replaceChildren();
    document.body.classList.remove("dialog-open");
    return;
  }
  document.body.classList.add("dialog-open");

  const close = el("button", { type: "button", class: "text-button", id: "close-issue", text: "Close" });
  close.addEventListener("click", () => closeIssue());

  let body;
  if (issue.empty) {
    body = [
      el("div", { class: "dialog-head" }, [
        el("h2", { id: "issue-title", text: "Nothing to send" }),
        close,
      ]),
      el("p", { text: "Edit a timeline item first. Send updates packages the changes for a GitHub issue." }),
    ];
  } else {
    const open = el("button", { type: "button", class: "primary", id: "open-issue", text: "Open GitHub issue" });
    open.addEventListener("click", confirmOpenIssue);
    const copy = el("button", { type: "button", id: "copy-updates", text: "Copy updates" });
    copy.addEventListener("click", () => {
      copyText(issue.body).then((ok) => {
        if (!state.issue) return;
        state.issue = { ...state.issue, notice: ok ? "Copied the issue text." : "Could not copy. Download the JSON instead." };
        render({ focusId: "copy-updates" });
      });
    });
    const download = el("button", { type: "button", id: "download-json", text: "Download JSON" });
    download.addEventListener("click", () => {
      const day = issue.document?.updatedOn || formatISO(startOfToday());
      downloadJson(`tracker-updates-${day}.json`, `${issue.json}\n`);
      state.issue = { ...state.issue, notice: "JSON file downloaded." };
      render({ focusId: "download-json" });
    });
    const keep = el("button", { type: "button", id: "keep-edits", text: "Keep edits" });
    keep.addEventListener("click", () => closeIssue("send-updates"));
    const clear = el("button", { type: "button", class: "danger", id: "clear-edits", text: "Clear local edits" });
    clear.addEventListener("click", resetEdits);

    body = [
      el("div", { class: "dialog-head" }, [
        el("h2", { id: "issue-title", text: issue.title }),
        close,
      ]),
      el("p", { class: "dialog-lede", text: "Issue draft for github.com/victorv83/Wedding-Planner. An assistant can merge the JSON into data/wedding.json." }),
      issue.tooLong
        ? el("p", { class: "warning inline-warning", text: "This body is too long for a GitHub link. Opening the issue copies the JSON so you can paste it." })
        : null,
      issue.notice ? el("p", { class: "dialog-notice", id: "issue-notice", role: "status", text: issue.notice }) : null,
      el("pre", { class: "issue-body", tabIndex: "0" }, [issue.body.trimEnd()]),
      el("div", { class: "dialog-actions" }, [open, copy, download]),
      el("div", { class: "dialog-actions" }, [keep, clear]),
    ];
  }

  const dialog = el("div", {
    class: "dialog",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "issue-title",
    tabIndex: "-1",
  }, body);
  dialog.addEventListener("keydown", trapTab);
  const backdrop = el("div", { class: "dialog-backdrop" }, [dialog]);
  root.replaceChildren(backdrop);
}

function trapTab(event) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const focusable = [...dialog.querySelectorAll("button, a, textarea, input, select, [href], [tabindex]")].filter((node) => {
    if (node.disabled || node.getAttribute("aria-hidden") === "true") return false;
    if (node.tabIndex < 0 && node !== dialog) return false;
    return node.offsetParent !== null || node === dialog;
  });
  const items = focusable.filter((node) => node !== dialog);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function scrollToContent() {
  const content = $("content");
  if (!content) return;
  requestAnimationFrame(() => {
    content.scrollIntoView({ block: "start" });
  });
}

function applyView(options = {}) {
  const view = viewFromHash(location.hash);
  const showAll = view === "all";
  for (const id of SECTION_IDS) {
    const mount = $(`mount-${id}`);
    if (mount) mount.hidden = !(showAll || view === id);
  }
  const how = $("how");
  if (how) how.hidden = !showAll;

  for (const link of document.querySelectorAll(".toc a[href]")) {
    const active = !showAll && viewFromHash(link.getAttribute("href")) === view;
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  const viewAll = $("view-all");
  if (viewAll) {
    if (showAll) viewAll.setAttribute("aria-current", "page");
    else viewAll.removeAttribute("aria-current");
  }

  if (options.scroll) scrollToContent();
}

function render(options = {}) {
  const y = window.scrollY;
  captureDraftFromDom();
  renderShellText();
  renderWarnings();
  renderOverview();
  renderProgress();
  renderTasks();
  renderVendors();
  renderGuideMounts();
  renderSendMount();
  renderIssue();
  applyView({ scroll: Boolean(options.scroll) });
  if (options.focusId) {
    const node = document.getElementById(options.focusId);
    if (node) {
      node.focus({ preventScroll: true });
      if (options.reveal) node.scrollIntoView({ block: "nearest" });
    }
  }
  if (!options.scroll && !options.reveal) window.scrollTo(0, y);
}

function renderFatal(error) {
  const status = $("app-status");
  status.hidden = false;
  status.replaceChildren(
    el("strong", { text: "The plan could not be loaded. " }),
    "Open this site through a web server so it can read data/wedding.json, and make sure that file is valid JSON. ",
    error?.message ? el("span", { text: error.message }) : "",
  );
  const how = $("how");
  if (how) how.hidden = false;
}

function renderGuideMounts() {
  const guides = state.guides;
  const tasks = viewTasks();
  if (!guides) return;
  $("mount-ceremony")?.replaceChildren(renderCeremony(guides, tasks));
  $("mount-guests")?.replaceChildren(renderGuests(state.model.guestPlan, state.guestEdits, (next) => {
    state.guestEdits = next;
    saveGuestEdits(next);
    render();
  }));
  $("mount-outreach")?.replaceChildren(renderOutreach(guides, tasks));
  $("mount-months")?.replaceChildren(renderMonths(guides, tasks));
  $("mount-dayof")?.replaceChildren(renderDayOf(guides));
}

async function init() {
  const response = await fetch("data/wedding.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load wedding data (${response.status}).`);
  const data = await response.json();
  const guidesResponse = await fetch("data/guides.json", { cache: "no-cache" });
  if (!guidesResponse.ok) throw new Error(`Could not load guides (${guidesResponse.status}).`);
  state.guides = await guidesResponse.json();
  state.model = buildModel(data);
  state.model.guestPlan = data.guestPlan || { target: 200, tableSize: 10, sides: [], households: [] };
  state.guestEdits = loadGuestEdits();
  state.quotes = normalizeQuotes(readJsonStorage(QUOTE_KEY) || {});
  state.actionChecks = readJsonStorage(ACTION_KEY) || {};
  const storedUnit = readJsonStorage(UNIT_KEY);
  state.cateringUnit = storedUnit?.id === "per-person" ? "per-person" : "per-table";
  state.edits = pruneEdits(state.model.tasks, loadEdits());
  saveEdits(state.edits);
  $("app-status").hidden = true;
  const hash = location.hash.replace(/^#/, "").trim();
  render({ scroll: hash !== "" });
}

function navigateTo(hash, { scroll = true } = {}) {
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (location.hash !== next) history.pushState(null, "", next);
  applyView({ scroll });
}

function bindChrome() {
  document.querySelector(".skip-link")?.addEventListener("click", (event) => {
    const content = $("content");
    if (!content) return;
    event.preventDefault();
    content.focus();
  });

  $("view-all")?.addEventListener("click", () => navigateTo("#all"));

  document.querySelector(".toc")?.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    event.preventDefault();
    navigateTo(href);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target?.tagName === "SUMMARY") {
      const details = event.target.parentElement;
      if (details?.tagName === "DETAILS") {
        event.preventDefault();
        details.open = !details.open;
      }
    }
    if (event.key !== "Escape") return;
    if (state.issue) {
      closeIssue();
      return;
    }
    if (state.editingId) {
      const focusId = state.editingId !== NEW_ITEM ? `edit-${state.editingId}` : "add-item";
      state.editingId = null;
      state.formErrors = [];
      render({ focusId });
    }
  });

  // Back, forward, and a pasted hash. pushState itself does not fire these.
  let queued = false;
  const onHistory = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      applyView({ scroll: true });
    });
  };
  window.addEventListener("hashchange", onHistory);
  window.addEventListener("popstate", onHistory);
  applyView();
}

bindChrome();
init().catch(renderFatal);
