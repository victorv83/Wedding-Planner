import {
  STATUS_LABELS,
  buildModel,
  candidateDates,
  categoriesInOrder,
  countdownLabel,
  countdownTarget,
  countdownWords,
  daysUntil,
  displayCouple,
  effectiveStatus,
  formatDue,
  formatLongDate,
  formatMoney,
  formatNumber,
  groupByPhase,
  isOverdue,
  knownCostTotal,
  normalizeStatus,
  parseISODate,
  previewOverrideForToggle,
  progressStats,
  pruneOverrides,
  resolveDue,
  roughSpan,
  safeHttpUrl,
  settingText,
  startOfToday,
} from "./logic.js";

const STORAGE_KEY = "weddingPlanner.previewStatus.v1";

const state = {
  model: null,
  statusFilter: "all",
  categoryFilter: "all",
  overrides: {},
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

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  try {
    if (!overrides || Object.keys(overrides).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* Private mode and blocked storage still allow an in-memory preview. */
  }
}

function fileStatus(task) {
  return normalizeStatus(task.status);
}

function shownStatus(task) {
  return effectiveStatus(task, state.overrides);
}

function currency() {
  return settingText(state.model.settings, "currency") || "USD";
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
  const kind = status === "done" ? "done" : status === "in-progress" ? "progress" : "todo";
  return el("span", { class: `badge badge-${kind}`, text: STATUS_LABELS[status] || STATUS_LABELS.todo });
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

function renderOverview() {
  const { settings } = state.model;
  const today = startOfToday();
  const target = countdownTarget(settings, today);
  const candidates = candidateDates(settings);
  const selectedIso = target && !target.tentative ? target.iso : "";

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
    const isSelected = candidate.iso === selectedIso;
    const isEarliest = Boolean(target?.tentative && candidate.iso === target.iso);
    let marker = "Candidate";
    if (isSelected) marker = "Selected";
    else if (isEarliest && target.allPast) marker = "Earliest · passed";
    else if (isEarliest) marker = "Earliest remaining";
    const current = isSelected || isEarliest;
    return el("li", current ? { "aria-current": "date" } : {}, [
      el("time", { datetime: candidate.iso, text: formatLongDate(candidate.date) }),
      el("span", { class: "badge", text: marker }),
    ]);
  });

  const facts = [];
  const guests = settings.guestCount;
  facts.push(["Guests", typeof guests === "number" && Number.isFinite(guests) ? formatNumber(guests) : "Not set"]);
  const budget = settings.budget;
  facts.push(["Budget", typeof budget === "number" && Number.isFinite(budget) ? formatMoney(budget, currency()) : "Not set"]);
  const tet = parseISODate(settings.tetDate);
  if (tet) {
    const label = settingText(settings, "tetLabel") || "Tết";
    facts.push([label, formatLongDate(tet), true]);
  }

  const section = el("section", { class: "section", id: "overview", "aria-labelledby": "overview-heading" }, [
    el("h2", { id: "overview-heading", text: "Countdown" }),
    el("div", { class: "panel" }, [
      countdownBlock,
      el("h3", { class: "subhead", text: "Candidate dates" }),
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

function renderProgress() {
  const { tasks, phases } = state.model;
  const file = progressStats(tasks, fileStatus);
  const preview = progressStats(tasks, shownStatus);
  const usingPreview = Object.keys(state.overrides).length > 0;

  const phaseMeters = groupByPhase(tasks, phases)
    .filter((group) => group.tasks.length > 0)
    .map((group) => meter(group.phase.title, progressStats(group.tasks, fileStatus), "From data/wedding.json"));

  const categoryMeters = categoriesInOrder(tasks).map((category) => {
    const subset = tasks.filter((task) => task.category === category);
    return meter(category, progressStats(subset, fileStatus), "From data/wedding.json");
  });

  const callout = usingPreview
    ? el("div", { class: "preview-callout" }, [
      el("p", {}, [
        el("strong", { text: "Browser preview: " }),
        `${preview.percent}% done (${preview.done} of ${preview.total}). The bars above stay with the data file, which says ${file.percent}% done. This preview is stored only in this browser.`,
      ]),
      el("button", { type: "button", id: "reset-preview", text: "Reset preview" }),
    ])
    : null;

  const section = el("section", { class: "section", id: "progress", "aria-labelledby": "progress-heading" }, [
    el("h2", { id: "progress-heading", text: "Progress" }),
    el("div", { class: "panel" }, [
      el("div", { class: "progress-hero" }, [
        el("p", { class: "percent" }, [String(file.percent), el("span", { text: "%" })]),
        el("div", {}, [
          el("p", { class: "source", text: "Saved in data/wedding.json" }),
          el("div", {
            class: "bar",
            role: "progressbar",
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "aria-valuenow": String(file.percent),
            "aria-label": "Overall progress from the data file",
          }, [el("span", { style: `width: ${file.percent}%` })]),
          el("p", { class: "fraction", id: "progress-summary", text: `${file.done} of ${file.total} tasks done · ${file.inProgress} in progress` }),
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
  $("reset-preview")?.addEventListener("click", () => {
    state.overrides = {};
    saveOverrides(state.overrides);
    render();
  });
}

function taskArticle(task) {
  const official = fileStatus(task);
  const effective = shownStatus(task);
  const previewing = Object.prototype.hasOwnProperty.call(state.overrides, task.id);
  const overdue = isOverdue(task, effective, startOfToday());
  const due = resolveDue(task);
  const classes = ["task"];
  if (effective === "done") classes.push("is-done");
  else if (effective === "in-progress") classes.push("is-progress");
  if (overdue) classes.push("is-overdue");

  const titleId = `task-title-${task.id}`;
  const badges = [badge(effective)];
  if (overdue) badges.push(el("span", { class: "badge badge-overdue", text: "Overdue" }));
  if (previewing) badges.push(el("span", { class: "badge badge-preview", text: "Preview" }));

  const vendorBits = [];
  if (task.vendorTracked) {
    const href = safeHttpUrl(task.vendorUrl);
    const name = task.vendorName || "Not chosen yet";
    const nameNode = href
      ? el("a", { href, target: "_blank", rel: "noopener noreferrer" }, [
        name,
        el("span", { class: "sr-only", text: " (opens in a new tab)" }),
      ])
      : name;
    vendorBits.push("Vendor: ", nameNode);
    if (typeof task.cost === "number") vendorBits.push(` · ${formatMoney(task.cost, currency())}`);
  }

  const checkboxId = `preview-${task.id}`;
  const checkbox = el("input", {
    id: checkboxId,
    type: "checkbox",
    "aria-describedby": "preview-hint",
  });
  checkbox.checked = effective === "done";
  checkbox.addEventListener("change", () => {
    const override = previewOverrideForToggle(official, checkbox.checked);
    if (override) state.overrides[task.id] = override;
    else delete state.overrides[task.id];
    saveOverrides(state.overrides);
    render({ focusId: checkboxId });
  });

  return el("article", { class: classes.join(" "), "aria-labelledby": titleId }, [
    el("div", { class: "task-top" }, [
      el("div", {}, [
        el("p", { class: "kicker", text: task.category }),
        el("h4", { id: titleId, text: task.title }),
      ]),
      el("div", { class: "badges" }, badges),
    ]),
    el("p", { class: "due" }, [
      el("span", { class: "sr-only", text: "Due date: " }),
      due
        ? el("time", { datetime: due.iso, text: formatDue(task) })
        : "No due date",
    ]),
    task.notes ? el("p", { class: "notes" }, richText(task.notes)) : null,
    vendorBits.length ? el("p", { class: "vendor-line" }, vendorBits) : null,
    previewing ? el("p", { class: "file-status", text: `Saved status: ${STATUS_LABELS[official]}` }) : null,
    el("label", { class: "preview-label", for: checkboxId }, [
      checkbox,
      "Preview as done",
    ]),
  ]);
}

function renderTasks() {
  const { tasks, phases } = state.model;
  const categories = categoriesInOrder(tasks);
  if (state.categoryFilter !== "all" && !categories.includes(state.categoryFilter)) {
    state.categoryFilter = "all";
  }

  const counts = {
    all: tasks.length,
    todo: tasks.filter((task) => shownStatus(task) === "todo").length,
    "in-progress": tasks.filter((task) => shownStatus(task) === "in-progress").length,
    done: tasks.filter((task) => shownStatus(task) === "done").length,
  };

  const statusSelect = el("select", { id: "filter-status" }, [
    el("option", { value: "all", text: `All (${counts.all})` }),
    el("option", { value: "todo", text: `To do (${counts.todo})` }),
    el("option", { value: "in-progress", text: `In progress (${counts["in-progress"]})` }),
    el("option", { value: "done", text: `Done (${counts.done})` }),
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
    if (state.statusFilter !== "all" && shownStatus(task) !== state.statusFilter) return false;
    if (state.categoryFilter !== "all" && task.category !== state.categoryFilter) return false;
    return true;
  });
  const visibleIds = new Set(visible.map((task) => task.id));
  const filtering = state.statusFilter !== "all" || state.categoryFilter !== "all";

  const groups = groupByPhase(tasks, phases)
    .map((group) => ({
      phase: group.phase,
      allTasks: group.tasks,
      tasks: group.tasks.filter((task) => visibleIds.has(task.id)),
    }))
    .filter((group) => group.tasks.length > 0);

  const phaseNodes = groups.map((group) => {
    const file = progressStats(group.allTasks, fileStatus);
    const preview = progressStats(group.allTasks, shownStatus);
    const countText = filtering
      ? `${group.tasks.length} shown`
      : file.done === preview.done
        ? `${file.done} / ${file.total} done in the data file`
        : `${file.done} / ${file.total} done in the data file · preview ${preview.done} / ${preview.total}`;
    return el("section", { class: "phase", "aria-labelledby": `phase-${group.phase.id}` }, [
      el("div", { class: "phase-head" }, [
        el("h3", { id: `phase-${group.phase.id}`, text: group.phase.title }),
        el("p", { class: "phase-count", text: countText }),
      ]),
      group.phase.summary ? el("p", { class: "phase-summary", text: group.phase.summary }) : null,
      el("div", { class: "phase-tasks" }, group.tasks.map(taskArticle)),
    ]);
  });

  const section = el("section", { class: "section", id: "tasks", "aria-labelledby": "tasks-heading" }, [
    el("h2", { id: "tasks-heading", text: "Timeline" }),
    el("div", { class: "filters" }, [
      el("label", { class: "filter", for: "filter-status" }, ["Status", statusSelect]),
      el("label", { class: "filter", for: "filter-category" }, ["Category", categorySelect]),
      filtering ? el("button", { type: "button", id: "clear-filters", text: "Clear filters" }) : null,
    ]),
    el("p", { class: "hint", id: "preview-hint", text: "Check “Preview as done” to try a status in this browser. The saved status stays in data/wedding.json. The status filter follows what is on screen, including previews." }),
    el("p", { class: "showing", text: filtering ? `Showing ${visible.length} of ${tasks.length} tasks` : `${tasks.length} tasks` }),
    visible.length
      ? el("div", { class: "timeline" }, phaseNodes)
      : el("p", { class: "empty", text: "No tasks match this filter." }),
  ]);

  $("mount-tasks").replaceChildren(section);
  $("clear-filters")?.addEventListener("click", () => {
    state.statusFilter = "all";
    state.categoryFilter = "all";
    render({ focusId: "filter-status" });
  });
}

function renderVendors() {
  const rows = state.model.tasks.filter((task) => task.vendorTracked);
  const costs = knownCostTotal(state.model.tasks);
  const blank = costs.tracked - costs.known;
  const totalText = costs.known === 0 ? "No costs entered yet" : formatMoney(costs.total, currency());
  const note = costs.known === 0
    ? "Add a number to cost when you know it."
    : `${costs.known} cost${costs.known === 1 ? "" : "s"} entered · ${blank} still blank`;

  const body = rows.map((task) => {
    const href = safeHttpUrl(task.vendorUrl);
    const name = task.vendorName || "Not chosen yet";
    const vendorCell = href
      ? el("a", { href, target: "_blank", rel: "noopener noreferrer" }, [
        name,
        el("span", { class: "sr-only", text: " (opens in a new tab)" }),
      ])
      : name;
    return el("tr", {}, [
      el("td", { "data-label": "Booking", text: task.title }),
      el("td", { class: "vendor", "data-label": "Vendor" }, [vendorCell]),
      el("td", { class: "num", "data-label": "Cost", text: typeof task.cost === "number" ? formatMoney(task.cost, currency()) : "—" }),
      el("td", { "data-label": "Status in file", text: STATUS_LABELS[fileStatus(task)] }),
    ]);
  });

  const table = el("table", {}, [
    el("caption", { text: "Bookings with a vendor name, link, or cost field. Status is the value saved in the data file. Blank costs are left out of the total." }),
    el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col", text: "Booking" }),
        el("th", { scope: "col", text: "Vendor" }),
        el("th", { scope: "col", class: "num", text: `Cost (${currency()})` }),
        el("th", { scope: "col", text: "Status in file" }),
      ]),
    ]),
    el("tbody", {}, body.length ? body : [el("tr", {}, [el("td", { colspan: "4", text: "No vendor fields yet. Add vendorName, vendorUrl, or cost to a task." })])]),
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
    el("div", { class: "table-scroll" }, [table]),
  ]);
  $("mount-vendors").replaceChildren(section);
}

function render(options = {}) {
  renderShellText();
  renderWarnings();
  renderOverview();
  renderProgress();
  renderTasks();
  renderVendors();
  if (options.focusId) {
    document.getElementById(options.focusId)?.focus({ preventScroll: true });
  }
}

function renderFatal(error) {
  const status = $("app-status");
  status.hidden = false;
  status.replaceChildren(
    el("strong", { text: "The plan could not be loaded. " }),
    "Open this site through a web server so it can read data/wedding.json, and make sure that file is valid JSON. ",
    error?.message ? el("span", { text: error.message }) : "",
  );
}

async function init() {
  const response = await fetch("data/wedding.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load wedding data (${response.status}).`);
  const data = await response.json();
  state.model = buildModel(data);
  state.overrides = pruneOverrides(state.model.tasks, loadOverrides());
  saveOverrides(state.overrides);
  $("app-status").hidden = true;
  render();
}

init().catch(renderFatal);
