/**
 * Pure rules for the wedding tracker.
 * The page and the node tests both import this file. No build step.
 */

export const STATUS_LABELS = {
  todo: "Not started",
  researching: "Researching",
  contacted: "Contacted",
  booked: "Booked",
  "in-progress": "In progress",
  done: "Done",
};

/** Status choices shown in the editor. `in-progress` is legacy and stays readable. */
export const STATUS_ORDER = ["todo", "researching", "contacted", "booked", "done"];

export const ISSUE_REPO = "victorv83/Wedding-Planner";

/** Full GitHub issue URLs longer than this open a short issue and rely on the clipboard. */
export const MAX_ISSUE_URL_LENGTH = 7000;

const VENDOR_CATEGORIES = new Set([
  "Venue",
  "Catering",
  "Planner",
  "Photo & video",
  "Music & MC",
  "Beauty",
  "Flowers & decor",
  "Attire",
  "Cake",
  "Transportation",
  "Invitations",
]);

/** Sections the nav can open. "all" stacks every section, including the save note. */
export const SECTION_IDS = ["overview", "progress", "timeline", "months", "dayof", "ceremony", "guests", "outreach", "vendors"];

const HASH_TO_SECTION = {
  overview: "overview",
  progress: "progress",
  timeline: "timeline",
  tasks: "timeline",
  months: "months",
  dayof: "dayof",
  ceremony: "ceremony",
  guests: "guests",
  outreach: "outreach",
  vendors: "vendors",
};

/**
 * Pick the view for a URL hash. Empty and unknown hashes open the first section.
 * #tasks is the older timeline anchor and opens the same section as #timeline.
 */
export function viewFromHash(hash) {
  const id = String(hash ?? "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  if (id === "all") return "all";
  return HASH_TO_SECTION[id] || "overview";
}

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function parseISODate(iso) {
  if (typeof iso !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function parseDueMonth(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const date = new Date(year, month, 0);
  return {
    date,
    iso: `${year}-${String(month).padStart(2, "0")}`,
  };
}

export function formatISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDue(task) {
  if (task?.due) {
    const date = parseISODate(task.due);
    if (date) return { date, precision: "day", iso: formatISO(date) };
  }
  if (task?.dueMonth) {
    const month = parseDueMonth(task.dueMonth);
    if (month) return { date: month.date, precision: "month", iso: month.iso };
  }
  return null;
}

export function normalizeStatus(status) {
  if (status === "not-started" || status === "not started") return "todo";
  if (Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) return status;
  return "todo";
}

/** Booked and done both finish a task. Researching, contacted, and legacy in-progress do not. */
export function isCompleteStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "done" || normalized === "booked";
}

export function isUnderwayStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "researching" || normalized === "contacted" || normalized === "in-progress";
}

export function isOverdue(task, status, today = startOfToday()) {
  if (isCompleteStatus(status)) return false;
  const due = resolveDue(task);
  if (!due) return false;
  return due.date.getTime() < today.getTime();
}

export function effectiveStatus(task, edits) {
  const entry = edits?.[task?.id];
  if (typeof entry === "string") return normalizeStatus(entry);
  if (entry && typeof entry === "object" && entry._op !== "delete" && entry.status != null) {
    return normalizeStatus(entry.status);
  }
  return normalizeStatus(task?.status);
}

/**
 * Quick “mark done” control. Checking sets done.
 * Unchecking restores the file status, unless the file itself says done —
 * then the task goes back to not started.
 */
export function statusAfterMarkDone(currentStatus, baselineStatus) {
  if (normalizeStatus(currentStatus) === "done") {
    const back = normalizeStatus(baselineStatus);
    return back === "done" ? "todo" : back;
  }
  return "done";
}

export function candidateDates(settings) {
  const list = Array.isArray(settings?.candidateDates) ? settings.candidateDates : [];
  const unique = [];
  const seen = new Set();
  for (const value of list) {
    const date = parseISODate(value);
    if (!date) continue;
    const iso = formatISO(date);
    if (seen.has(iso)) continue;
    seen.add(iso);
    unique.push({ iso, date });
  }
  unique.sort((a, b) => a.date - b.date);
  return unique;
}

export function countdownTarget(settings, today = startOfToday()) {
  const selected = parseISODate(settings?.selectedDate);
  if (selected) {
    return {
      date: selected,
      iso: formatISO(selected),
      tentative: false,
      ideal: false,
      allPast: selected.getTime() < today.getTime(),
    };
  }
  const ideal = parseISODate(settings?.idealDate);
  if (ideal) {
    return {
      date: ideal,
      iso: formatISO(ideal),
      tentative: true,
      ideal: true,
      allPast: ideal.getTime() < today.getTime(),
    };
  }
  const candidates = candidateDates(settings);
  if (candidates.length === 0) return null;
  const upcoming = candidates.filter((item) => item.date.getTime() >= today.getTime());
  const pick = upcoming[0] || candidates[0];
  return {
    date: pick.date,
    iso: pick.iso,
    tentative: true,
    ideal: false,
    allPast: upcoming.length === 0,
  };
}

export function countdownLabel(target) {
  if (!target) return "";
  if (!target.tentative) return "Selected date";
  if (target.ideal) return target.allPast ? "Tentative · ideal date has passed" : "Tentative · ideal date";
  if (target.allPast) return "Tentative · every candidate date has passed";
  return "Tentative · earliest remaining candidate date";
}

/** Badge for one row in the date list. An ideal date stays tentative until selectedDate is set. */
export function dateListMarker({ iso, idealIso = "", selectedIso = "", fallbackIso = "", allPast = false }) {
  if (selectedIso && iso === selectedIso) return "Selected";
  if (idealIso && iso === idealIso) return allPast ? "Ideal · passed" : "Ideal";
  if (idealIso) return "Alternative";
  if (fallbackIso && iso === fallbackIso) return allPast ? "Earliest · passed" : "Earliest remaining";
  return "Candidate";
}

export function daysUntil(target, today = startOfToday()) {
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((utcTarget - utcToday) / 86400000);
}

export function countdownWords(days) {
  if (days === 0) return { number: "0", unit: "Today" };
  if (days > 0) return { number: String(days), unit: days === 1 ? "day to go" : "days to go" };
  const elapsed = Math.abs(days);
  return { number: String(elapsed), unit: elapsed === 1 ? "day ago" : "days ago" };
}

export function roughSpan(days) {
  const abs = Math.abs(days);
  if (abs < 14) return "";
  const months = Math.round(abs / 30.4375);
  if (months <= 1) {
    const weeks = Math.max(2, Math.round(abs / 7));
    return `About ${weeks} weeks`;
  }
  if (months < 24) return `About ${months} months`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  const yearLabel = years === 1 ? "1 year" : `${years} years`;
  if (remainder === 0) return `About ${yearLabel}`;
  return `About ${yearLabel} and ${remainder} months`;
}

export function progressStats(tasks, statusOf) {
  const total = tasks.length;
  let done = 0;
  let inProgress = 0;
  for (const task of tasks) {
    const status = statusOf(task);
    if (isCompleteStatus(status)) done += 1;
    else if (isUnderwayStatus(status)) inProgress += 1;
  }
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, inProgress, todo: total - done - inProgress, percent };
}

export function groupByPhase(tasks, phases) {
  const phaseList = Array.isArray(phases) ? phases : [];
  const known = new Set(phaseList.map((phase) => phase.id));
  const buckets = new Map(phaseList.map((phase) => [phase.id, []]));
  const extras = [];
  for (const task of tasks) {
    if (known.has(task.phase)) buckets.get(task.phase).push(task);
    else extras.push(task);
  }
  const groups = phaseList.map((phase) => ({
    phase,
    tasks: buckets.get(phase.id),
  }));
  if (extras.length > 0) {
    groups.push({
      phase: {
        id: "other",
        title: "Other",
        summary: "These tasks use a phase id that is not listed under phases.",
      },
      tasks: extras,
    });
  }
  return groups;
}

export function categoriesInOrder(tasks) {
  const categories = [];
  for (const task of tasks) {
    if (task.category && !categories.includes(task.category)) categories.push(task.category);
  }
  return categories;
}

export function isVendorRow(task) {
  if (!task || typeof task !== "object") return false;
  return ["vendorName", "vendorUrl", "vendorPhone", "cost", "deposit", "balanceDue"].some((key) =>
    Object.prototype.hasOwnProperty.call(task, key),
  );
}

export function categorySuggestsVendor(category) {
  return VENDOR_CATEGORIES.has(category);
}

/** Earliest incomplete task that has a target date. The wedding-day countdown stays on settings. */
export function nextOpenTarget(tasks, today = startOfToday()) {
  let best = null;
  for (const task of tasks || []) {
    if (isCompleteStatus(task?.status)) continue;
    const due = resolveDue(task);
    if (!due) continue;
    if (!best || due.date.getTime() < best.due.date.getTime()) best = { task, due };
  }
  if (!best) return null;
  const days = daysUntil(best.due.date, today);
  return { ...best, days };
}

export function knownCostTotal(tasks) {
  let total = 0;
  let known = 0;
  let tracked = 0;
  for (const task of tasks) {
    if (!task.vendorTracked) continue;
    tracked += 1;
    if (typeof task.cost === "number" && Number.isFinite(task.cost)) {
      total += task.cost;
      known += 1;
    }
  }
  return { total, known, tracked };
}

export function safeHttpUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

export function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatMonthYear(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDue(task) {
  const due = resolveDue(task);
  if (!due) return "No due date";
  if (due.precision === "month") return `By ${formatMonthYear(due.date)}`;
  return formatLongDate(due.date);
}

export function formatMoney(amount, currency = "USD") {
  const code = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency.trim())
    ? currency.trim().toUpperCase()
    : "USD";
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  }
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function displayCouple(settings) {
  const name = typeof settings?.coupleDisplayName === "string" ? settings.coupleDisplayName.trim() : "";
  return name || "Victor & Mít";
}

export function settingText(settings, key) {
  const value = settings?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function textOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export const ALCOHOL_POLICIES = {
  yes: "BYO alcohol",
  bartender: "BYO with licensed bartender",
  no: "No BYO alcohol",
  unknown: "Alcohol unknown",
};

export const CATERING_POLICIES = {
  yes: "Outside catering",
  approved: "Approved caterers only",
  no: "No outside catering",
  unknown: "Catering unknown",
};

export function venuePolicy(category) {
  return cleanString(category).toLowerCase() === "venue";
}

export function normalizeAlcohol(value) {
  return Object.prototype.hasOwnProperty.call(ALCOHOL_POLICIES, value) ? value : "unknown";
}

export function normalizeCatering(value) {
  return Object.prototype.hasOwnProperty.call(CATERING_POLICIES, value) ? value : "unknown";
}

function parseRange(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  if (!finite(raw.low) || !finite(raw.high) || raw.low < 0 || raw.high < raw.low) return undefined;
  return { low: raw.low, high: raw.high };
}

function parseSources(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((source) => ({ label: textOr(source?.label, ""), url: safeHttpUrl(source?.url) }))
    .filter((source) => source.label && source.url);
}

export const BUDGET_GROUPS = {
  wedding: "Wedding day",
  optional: "Optional",
  parties: "Bachelor and bachelorette",
};

/** Low and high cost of one budget line at a guest count: flat + perGuest × guests. */
export function estimateLine(line, guests) {
  const n = finite(guests) && guests > 0 ? guests : 0;
  const flat = line?.flat || { low: 0, high: 0 };
  const per = line?.perGuest || { low: 0, high: 0 };
  return {
    low: Math.round(flat.low + per.low * n),
    high: Math.round(flat.high + per.high * n),
  };
}

/**
 * Totals for one guest count. The wedding group gets contingency on top.
 * Optional lines and bachelor/bachelorette costs stay out of the wedding total.
 */
export function budgetTotals(budget, guests) {
  const groups = {};
  for (const key of Object.keys(BUDGET_GROUPS)) groups[key] = { low: 0, high: 0 };
  for (const line of budget?.lines || []) {
    const cost = estimateLine(line, guests);
    const group = groups[line.group] ? line.group : "wedding";
    groups[group].low += cost.low;
    groups[group].high += cost.high;
  }
  const pct = budget?.contingencyPercent || { low: 0, high: 0 };
  const contingency = {
    low: Math.round((groups.wedding.low * pct.low) / 100),
    high: Math.round((groups.wedding.high * pct.high) / 100),
  };
  const wedding = {
    low: groups.wedding.low + contingency.low,
    high: groups.wedding.high + contingency.high,
  };
  const perGuest = guests > 0
    ? { low: Math.round(wedding.low / guests), high: Math.round(wedding.high / guests) }
    : null;
  return { groups, contingency, wedding, perGuest };
}

function parseBudget(raw, taskIds, warnings) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const counts = (Array.isArray(raw.guestCounts) ? raw.guestCounts : []).filter((n) => finite(n) && n > 0);
  const pct = parseRange(raw.contingencyPercent) || { low: 0, high: 0 };
  const seen = new Set();
  const lines = [];
  for (const [index, line] of (Array.isArray(raw.lines) ? raw.lines : []).entries()) {
    const id = textOr(line?.id, `line-${index + 1}`);
    const item = textOr(line?.item, id);
    if (seen.has(id)) warnings.push(`Budget line “${item}” repeats the id “${id}”.`);
    seen.add(id);
    const flat = parseRange(line?.flat);
    const perGuest = parseRange(line?.perGuest);
    if (flat === undefined || perGuest === undefined) {
      warnings.push(`Budget line “${item}” needs low and high numbers, with high at least low.`);
      continue;
    }
    if (!flat && !perGuest) {
      warnings.push(`Budget line “${item}” has no flat or perGuest cost.`);
      continue;
    }
    const taskId = textOr(line?.taskId, "");
    if (taskId && !taskIds.has(taskId)) warnings.push(`Budget line “${item}” points at task “${taskId}”, which does not exist.`);
    lines.push({
      id,
      item,
      category: textOr(line?.category, "General"),
      taskId,
      group: BUDGET_GROUPS[line?.group] ? line.group : "wedding",
      flat,
      perGuest,
      basis: textOr(line?.basis, ""),
      priceType: line?.priceType === "listed" ? "listed" : "estimate",
      notes: textOr(line?.notes, ""),
      sources: parseSources(line?.sources),
    });
  }
  const plan = parsePlan(raw.plan, lines, warnings);
  const ceilings = (Array.isArray(raw.ceilings) ? raw.ceilings : []).filter((n) => finite(n) && n > 0);
  return {
    asOf: textOr(raw.asOf, ""),
    summary: textOr(raw.summary, ""),
    guestCounts: counts,
    contingencyPercent: pct,
    target: finite(raw.target) ? raw.target : null,
    ceilings,
    lines,
    plan,
  };
}

function parsePlan(raw, lines, warnings) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const byId = new Map(lines.map((line) => [line.id, line]));
  const guests = finite(raw.guests) && raw.guests > 0 ? raw.guests : 0;
  const planLines = [];
  for (const entry of Array.isArray(raw.lines) ? raw.lines : []) {
    const lineId = textOr(entry?.lineId, "");
    const source = byId.get(lineId);
    if (!source) {
      warnings.push(`The $50k plan points at “${lineId || "a line"}”, which is not a budget line.`);
      continue;
    }
    if (!finite(entry?.amount) || entry.amount < 0) {
      warnings.push(`The $50k plan amount for “${source.item}” needs to be a number.`);
      continue;
    }
    const estimate = estimateLine(source, guests);
    let over = "";
    if (estimate.low > entry.amount) over = "over";
    else if (entry.amount > estimate.low && estimate.high > entry.amount) over = "high";
    planLines.push({
      lineId,
      item: source.item,
      amount: entry.amount,
      choice: textOr(entry?.choice, ""),
      priceType: source.priceType,
      estimate,
      over,
    });
  }
  const barOptions = [];
  for (const option of Array.isArray(raw.barOptions) ? raw.barOptions : []) {
    if (!finite(option?.amount) || option.amount < 0) continue;
    barOptions.push({
      id: textOr(option?.id, "bar"),
      lineId: textOr(option?.lineId, ""),
      label: textOr(option?.label, "Bar"),
      amount: option.amount,
      priceType: option?.priceType === "listed" ? "listed" : "estimate",
      basis: textOr(option?.basis, ""),
    });
  }
  return {
    id: textOr(raw.id, "plan"),
    label: textOr(raw.label, "Plan"),
    guests,
    summary: textOr(raw.summary, ""),
    lines: planLines,
    barOptions,
  };
}

/** Whether the researched range and the cost-saving plan fit the target at one guest count. */
export function fitReport(budget, guests, target) {
  const estimate = budgetTotals(budget, guests).wedding;
  const plan = planTotals(budget);
  const cautious = plan?.cautious?.total || null;
  return {
    guests,
    target,
    estimate,
    cautious,
    estimateFitsLow: estimate.low <= target,
    estimateFitsHigh: estimate.high <= target,
    planFitsHigh: cautious ? cautious.high <= target : null,
  };
}

export function monthsInRange(start, end) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const months = [];
  let year = sy;
  let month = sm;
  while (year < ey || (year === ey && month <= em)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function tasksInMonth(tasks, yearMonth) {
  return (tasks || []).filter((task) => {
    const due = resolveDue(task);
    if (!due) return false;
    const month = `${due.date.getFullYear()}-${String(due.date.getMonth() + 1).padStart(2, "0")}`;
    return month === yearMonth;
  });
}

export function guestSideTotal(plan) {
  return (plan?.sides || []).reduce((sum, side) => sum + (Number(side.estimate) || 0), 0);
}

export function guestTablePlan(plan) {
  const size = plan?.tableSize > 0 ? plan.tableSize : 10;
  const target = plan?.target > 0 ? plan.target : 0;
  const tables = target ? Math.ceil(target / size) : 0;
  const assigned = (plan?.households || []).reduce((sum, house) => sum + (Number(house.count) || 0), 0);
  return { size, target, tables, seats: tables * size, assigned };
}

/** Both bar choices, with contingency. The cautious total is the higher one. */
export function planTotals(budget) {
  const plan = budget?.plan;
  if (!plan) return null;
  const base = plan.lines.reduce((sum, line) => sum + line.amount, 0);
  const pct = budget.contingencyPercent || { low: 0, high: 0 };
  const options = plan.barOptions.map((option) => {
    const subtotal = base + option.amount;
    const contingency = {
      low: Math.round((subtotal * pct.low) / 100),
      high: Math.round((subtotal * pct.high) / 100),
    };
    const total = { low: subtotal + contingency.low, high: subtotal + contingency.high };
    const perGuest = plan.guests > 0
      ? { low: Math.round(total.low / plan.guests), high: Math.round(total.high / plan.guests) }
      : null;
    return { ...option, subtotal, contingency, total, perGuest };
  });
  const cautious = options.reduce((best, option) => (option.total.high > (best?.total.high ?? -1) ? option : best), null);
  return { base, options, cautious };
}

export function perGuestCeiling(target, guests) {
  if (!finite(target) || !finite(guests) || guests <= 0) return null;
  return Math.floor(target / guests);
}

function parseVendorOptions(raw, taskIds, warnings) {
  const seen = new Set();
  const vendors = [];
  for (const [index, item] of (Array.isArray(raw) ? raw : []).entries()) {
    const name = textOr(item?.name, "");
    if (!name) {
      warnings.push(`Vendor option ${index + 1} is missing a name.`);
      continue;
    }
    const id = textOr(item?.id, `vendor-${index + 1}`);
    if (seen.has(id)) warnings.push(`Vendor option “${name}” repeats the id “${id}”.`);
    seen.add(id);
    const taskId = textOr(item?.taskId, "");
    if (taskId && !taskIds.has(taskId)) warnings.push(`Vendor option “${name}” points at task “${taskId}”, which does not exist.`);
    if (item?.url && !safeHttpUrl(item.url)) warnings.push(`Vendor option “${name}” has a link that is not http or https.`);
    const source = item?.source ? parseSources([item.source])[0] || null : null;
    const policySource = item?.policySource ? parseSources([item.policySource])[0] || null : null;
    const isVenue = textOr(item?.category, "") === "Venue" || taskId === "venue-reception";
    vendors.push({
      id,
      name,
      category: textOr(item?.category, "General"),
      taskId,
      url: safeHttpUrl(item?.url),
      base: textOr(item?.base, ""),
      pricing: textOr(item?.pricing, ""),
      priceType: ["listed", "estimate"].includes(item?.priceType) ? item.priceType : "quote",
      fit: textOr(item?.fit, ""),
      caveat: textOr(item?.caveat, ""),
      source,
      byoAlcohol: isVenue ? normalizeAlcohol(item?.byoAlcohol) : "",
      outsideCatering: isVenue ? normalizeCatering(item?.outsideCatering) : "",
      policySource,
      email: textOr(item?.email, ""),
      phone: textOr(item?.phone, ""),
    });
  }
  return vendors;
}

function parseWeddingParty(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const trays = (Array.isArray(raw.teaCeremonyTrays) ? raw.teaCeremonyTrays : []).filter((n) => finite(n) && n > 0);
  return {
    bridesmaids: finite(raw.bridesmaids) ? raw.bridesmaids : null,
    groomsmen: finite(raw.groomsmen) ? raw.groomsmen : null,
    teaCeremonyTrays: trays,
    summary: textOr(raw.summary, ""),
    sources: parseSources(raw.sources),
  };
}

/** Extra people each side needs so every tray has a carrier and a receiver. */
export function extraTrayCarriers(party, trays) {
  const smallest = Math.min(party?.bridesmaids ?? 0, party?.groomsmen ?? 0);
  return Math.max(0, trays - smallest);
}

/** Vendor options grouped by category, in first-seen order. */
export function groupVendorOptions(vendors) {
  const groups = [];
  const byCategory = new Map();
  for (const vendor of vendors || []) {
    if (!byCategory.has(vendor.category)) {
      const group = { category: vendor.category, vendors: [] };
      byCategory.set(vendor.category, group);
      groups.push(group);
    }
    byCategory.get(vendor.category).vendors.push(vendor);
  }
  return groups;
}

export function buildModel(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Wedding data must be a JSON object.");
  }
  if (!Array.isArray(data.tasks)) {
    throw new Error("Wedding data needs a tasks array.");
  }

  const settings =
    data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
      ? data.settings
      : {};

  const phases = (Array.isArray(data.phases) ? data.phases : [])
    .filter((phase) => phase && typeof phase.id === "string" && phase.id.trim())
    .map((phase) => ({
      id: phase.id.trim(),
      title: textOr(phase.title, phase.id.trim()),
      summary: textOr(phase.summary, ""),
    }));

  const phaseIds = new Set(phases.map((phase) => phase.id));
  const seen = new Set();
  const warnings = [];
  const tasks = data.tasks.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Task ${index + 1} is not an object.`);
    }
    const id = textOr(raw.id, "");
    if (!id) throw new Error(`Task ${index + 1} is missing an id.`);
    if (seen.has(id)) throw new Error(`Duplicate task id “${id}”.`);
    seen.add(id);

    const title = textOr(raw.title, "Untitled task");
    if (raw.status != null && !Object.prototype.hasOwnProperty.call(STATUS_LABELS, raw.status)) {
      warnings.push(`“${title}” has an unknown status. Use todo, researching, contacted, booked, in-progress, or done.`);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "cost") && raw.cost != null && !(typeof raw.cost === "number" && Number.isFinite(raw.cost))) {
      warnings.push(`“${title}” cost should be a number or null, with no currency symbol.`);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "deposit") && raw.deposit != null && !(typeof raw.deposit === "number" && Number.isFinite(raw.deposit))) {
      warnings.push(`“${title}” deposit should be a number or null, with no currency symbol.`);
    }

    const due = typeof raw.due === "string" ? raw.due.trim() : "";
    const dueMonth = typeof raw.dueMonth === "string" ? raw.dueMonth.trim() : "";
    const dueOk = (due && parseISODate(due)) || (dueMonth && parseDueMonth(dueMonth));
    if ((due || dueMonth) && !dueOk) {
      warnings.push(`“${title}” has a due value that is not YYYY-MM-DD or YYYY-MM.`);
    }
    const balanceDueRaw = typeof raw.balanceDue === "string" ? raw.balanceDue.trim() : "";
    const balanceDue = parseISODate(balanceDueRaw) ? balanceDueRaw : "";
    if (balanceDueRaw && !balanceDue) {
      warnings.push(`“${title}” balanceDue is not YYYY-MM-DD.`);
    }

    const phase = textOr(raw.phase, "");
    if (phase && !phaseIds.has(phase)) {
      warnings.push(`“${title}” uses phase “${phase}”, which is not listed under phases.`);
    }

    return {
      id,
      title,
      category: textOr(raw.category, "General"),
      phase,
      status: normalizeStatus(raw.status),
      notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
      due,
      dueMonth,
      vendorTracked: isVendorRow(raw),
      vendorName: typeof raw.vendorName === "string" ? raw.vendorName.trim() : "",
      vendorUrl: raw.vendorUrl ?? null,
      vendorPhone: typeof raw.vendorPhone === "string" ? raw.vendorPhone.trim() : "",
      cost: typeof raw.cost === "number" && Number.isFinite(raw.cost) ? raw.cost : null,
      deposit: typeof raw.deposit === "number" && Number.isFinite(raw.deposit) ? raw.deposit : null,
      balanceDue,
      byoAlcohol: venuePolicy(textOr(raw.category, "General")) ? normalizeAlcohol(raw.byoAlcohol) : "",
      outsideCatering: venuePolicy(textOr(raw.category, "General")) ? normalizeCatering(raw.outsideCatering) : "",
      local: "file",
    };
  });

  if (settings.idealDate != null && settings.idealDate !== "" && !parseISODate(settings.idealDate)) {
    warnings.push("settings.idealDate needs to be null or a YYYY-MM-DD date. The countdown is using a candidate date instead.");
  }
  if (settings.selectedDate != null && settings.selectedDate !== "" && !parseISODate(settings.selectedDate)) {
    warnings.push("settings.selectedDate needs to be null or a YYYY-MM-DD date. The countdown is using the ideal date, or a candidate date if that is missing.");
  }
  if (settings.guestCount != null && !(typeof settings.guestCount === "number" && Number.isFinite(settings.guestCount))) {
    warnings.push("settings.guestCount needs to be null or a number.");
  }
  if (settings.budget != null && !(typeof settings.budget === "number" && Number.isFinite(settings.budget))) {
    warnings.push("settings.budget needs to be null or a number.");
  }
  if (settings.tetDate != null && settings.tetDate !== "" && !parseISODate(settings.tetDate)) {
    warnings.push("settings.tetDate needs to be a YYYY-MM-DD date.");
  }
  for (const value of Array.isArray(settings.candidateDates) ? settings.candidateDates : []) {
    if (!parseISODate(value)) warnings.push(`Candidate date “${value}” is not YYYY-MM-DD and was skipped.`);
  }

  const taskIds = new Set(tasks.map((task) => task.id));
  const budget = parseBudget(data.budgetEstimate, taskIds, warnings);
  const vendorOptions = parseVendorOptions(data.vendorOptions, taskIds, warnings);
  const weddingParty = parseWeddingParty(data.weddingParty);

  return { settings, phases, tasks, warnings, budget, vendorOptions, weddingParty };
}

const PATCH_FIELDS = [
  "title",
  "category",
  "phase",
  "status",
  "notes",
  "due",
  "dueMonth",
  "vendorTracked",
  "vendorName",
  "vendorUrl",
  "vendorPhone",
  "cost",
  "deposit",
  "balanceDue",
  "byoAlcohol",
  "outsideCatering",
];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanMoney(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanUrl(value) {
  if (value == null) return null;
  const text = cleanString(String(value));
  return text || null;
}

export function parseMoneyInput(value) {
  if (value == null) return { ok: true, amount: null };
  const text = String(value).trim();
  if (!text) return { ok: true, amount: null };
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, amount: null };
  return { ok: true, amount: Number(cleaned) };
}

function vendorDetailsPresent(task) {
  if (!task || typeof task !== "object") return false;
  return Boolean(
    cleanString(task.vendorName) ||
    cleanUrl(task.vendorUrl) ||
    cleanString(task.vendorPhone) ||
    cleanMoney(task.cost) != null ||
    cleanMoney(task.deposit) != null ||
    parseISODate(task.balanceDue),
  );
}

export function taskSnapshot(task) {
  const due = parseISODate(task?.due) ? cleanString(task.due) : "";
  const dueMonth = parseDueMonth(task?.dueMonth) ? cleanString(task.dueMonth) : "";
  const balanceDue = parseISODate(task?.balanceDue) ? cleanString(task.balanceDue) : "";
  const vendorTracked = Boolean(task?.vendorTracked) || vendorDetailsPresent(task);
  const snapshot = {
    title: cleanString(task?.title) || "Untitled task",
    category: cleanString(task?.category) || "General",
    phase: cleanString(task?.phase),
    status: normalizeStatus(task?.status),
    notes: cleanString(task?.notes),
    due,
    dueMonth,
    vendorTracked,
    vendorName: vendorTracked ? cleanString(task?.vendorName) : "",
    vendorUrl: vendorTracked ? cleanUrl(task?.vendorUrl) : null,
    vendorPhone: vendorTracked ? cleanString(task?.vendorPhone) : "",
    cost: vendorTracked ? cleanMoney(task?.cost) : null,
    deposit: vendorTracked ? cleanMoney(task?.deposit) : null,
    balanceDue: vendorTracked ? balanceDue : "",
    byoAlcohol: venuePolicy(task?.category) ? normalizeAlcohol(task?.byoAlcohol) : "",
    outsideCatering: venuePolicy(task?.category) ? normalizeCatering(task?.outsideCatering) : "",
  };
  return snapshot;
}

function emitValue(field, value) {
  if (field === "vendorName" || field === "vendorPhone" || field === "vendorUrl" || field === "balanceDue") {
    if (value == null || value === "") return null;
    return value;
  }
  if (field === "cost" || field === "deposit") return cleanMoney(value);
  if (field === "vendorTracked") return Boolean(value);
  return value ?? "";
}

function sameSnapshotField(field, a, b) {
  if (field === "cost" || field === "deposit") return cleanMoney(a) === cleanMoney(b);
  if (field === "vendorUrl") return cleanUrl(a) === cleanUrl(b);
  if (field === "vendorTracked") return Boolean(a) === Boolean(b);
  if (field === "status") return normalizeStatus(a) === normalizeStatus(b);
  return cleanString(a) === cleanString(b);
}

function decodeField(field, value) {
  if (field === "status") return normalizeStatus(value);
  if (field === "cost" || field === "deposit") return cleanMoney(value);
  if (field === "vendorUrl") return cleanUrl(value);
  if (field === "vendorTracked") return Boolean(value);
  if (field === "due") return parseISODate(value) ? cleanString(value) : "";
  if (field === "dueMonth") return parseDueMonth(value) ? cleanString(value) : "";
  if (field === "balanceDue") return parseISODate(value) ? cleanString(value) : "";
  return cleanString(value);
}

export function diffTask(baseline, next) {
  const before = taskSnapshot(baseline);
  const after = taskSnapshot(next);
  const patch = {};
  for (const field of PATCH_FIELDS) {
    if (!sameSnapshotField(field, before[field], after[field])) {
      patch[field] = emitValue(field, after[field]);
    }
  }
  return patch;
}

function clearVendor(snapshot) {
  snapshot.vendorTracked = false;
  snapshot.vendorName = "";
  snapshot.vendorUrl = null;
  snapshot.vendorPhone = "";
  snapshot.cost = null;
  snapshot.deposit = null;
  snapshot.balanceDue = "";
  return snapshot;
}

export function applyTaskPatch(baseline, patch) {
  const next = { ...baseline, ...taskSnapshot(baseline), id: baseline.id };
  for (const field of PATCH_FIELDS) {
    if (field === "vendorTracked") continue;
    if (Object.prototype.hasOwnProperty.call(patch, field)) next[field] = decodeField(field, patch[field]);
  }
  if (patch.vendorTracked === false) clearVendor(next);
  else if (patch.vendorTracked === true || vendorDetailsPresent(next)) next.vendorTracked = true;
  next.local = "edited";
  return next;
}

export function materializeAdded(id, patch) {
  const snapshot = taskSnapshot({
    title: patch.title,
    category: patch.category,
    phase: patch.phase,
    status: patch.status,
    notes: patch.notes,
    due: patch.due,
    dueMonth: patch.dueMonth,
    vendorTracked: Boolean(patch.vendorTracked) || vendorDetailsPresent(patch),
    vendorName: patch.vendorName,
    vendorUrl: patch.vendorUrl,
    vendorPhone: patch.vendorPhone,
    cost: patch.cost,
    deposit: patch.deposit,
    balanceDue: patch.balanceDue,
  });
  if (!snapshot.vendorTracked) clearVendor(snapshot);
  return { id, ...snapshot, local: "added" };
}

export function serializeAdd(id, snapshot) {
  const clean = taskSnapshot(snapshot);
  const record = {
    _op: "add",
    id,
    title: clean.title,
    category: clean.category,
    phase: clean.phase,
    status: clean.status,
    notes: clean.notes,
    due: clean.due,
    dueMonth: clean.dueMonth,
  };
  if (clean.vendorTracked) {
    record.vendorTracked = true;
    record.vendorName = clean.vendorName || null;
    record.vendorUrl = clean.vendorUrl;
    record.vendorPhone = clean.vendorPhone || null;
    record.cost = clean.cost;
    record.deposit = clean.deposit;
    record.balanceDue = clean.balanceDue || null;
  }
  return record;
}

export function slugTaskId(title, taken) {
  const base = String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "item";
  const used = taken instanceof Set ? taken : new Set(taken || []);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function websiteError(value) {
  const text = cleanString(value);
  if (!text) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !safeHttpUrl(text)) {
    return "Website needs to start with http:// or https://.";
  }
  return "";
}

/**
 * Form values from the timeline editor.
 * duePrecision is "day", "month", or "none". Money fields are raw strings.
 */
export function snapshotFromDraft(draft) {
  const errors = [];
  const title = cleanString(draft?.title);
  if (!title) errors.push("Add a title.");
  else if (title.length > 180 || /[\r\n]/.test(title)) errors.push("Title needs to be one line, up to 180 characters.");

  const category = cleanString(draft?.category) || "General";
  const phase = cleanString(draft?.phase);
  if (!phase) errors.push("Choose a phase.");

  const notes = typeof draft?.notes === "string" ? draft.notes.trim() : "";
  if (notes.length > 4000) errors.push("Notes need to be 4,000 characters or fewer.");

  const precision = draft?.duePrecision === "month" || draft?.duePrecision === "none" ? draft.duePrecision : "day";
  let due = "";
  let dueMonth = "";
  if (precision === "day") {
    const day = cleanString(draft?.due);
    if (!day) errors.push("Pick a target day, or choose a month or no date.");
    else if (!parseISODate(day)) errors.push("Target date needs to be a real calendar day.");
    else due = day;
  } else if (precision === "month") {
    const month = cleanString(draft?.dueMonth);
    if (!month) errors.push("Pick a target month, or choose a day or no date.");
    else if (!parseDueMonth(month)) errors.push("Target month needs to be YYYY-MM.");
    else dueMonth = month;
  }

  const vendorTracked = Boolean(draft?.vendorTracked);
  const costParsed = parseMoneyInput(draft?.cost);
  const depositParsed = parseMoneyInput(draft?.deposit);
  if (vendorTracked && !costParsed.ok) errors.push("Quoted cost needs to be a number, or blank.");
  if (vendorTracked && !depositParsed.ok) errors.push("Deposit needs to be a number, or blank.");

  let balanceDue = "";
  let vendorName = "";
  let vendorPhone = "";
  let vendorUrl = null;
  if (vendorTracked) {
    vendorName = cleanString(draft?.vendorName);
    vendorPhone = cleanString(draft?.vendorPhone);
    if (vendorName.length > 120) errors.push("Vendor name needs to be 120 characters or fewer.");
    if (vendorPhone.length > 40) errors.push("Phone needs to be 40 characters or fewer.");
    const site = cleanString(draft?.vendorUrl);
    const siteProblem = websiteError(site);
    if (siteProblem) errors.push(siteProblem);
    else if (site.length > 300) errors.push("Website needs to be 300 characters or fewer.");
    else vendorUrl = site || null;
    const balance = cleanString(draft?.balanceDue);
    if (balance && !parseISODate(balance)) errors.push("Balance due date needs to be a real calendar day.");
    else balanceDue = balance;
  }

  return {
    errors,
    snapshot: {
      title: title || "Untitled task",
      category,
      phase,
      status: normalizeStatus(draft?.status),
      notes,
      due,
      dueMonth,
      vendorTracked,
      vendorName,
      vendorUrl,
      vendorPhone,
      cost: vendorTracked && costParsed.ok ? costParsed.amount : null,
      deposit: vendorTracked && depositParsed.ok ? depositParsed.amount : null,
      balanceDue,
      byoAlcohol: venuePolicy(category) ? normalizeAlcohol(draft?.byoAlcohol) : "",
      outsideCatering: venuePolicy(category) ? normalizeCatering(draft?.outsideCatering) : "",
    },
  };
}

export function applyEdits(tasks, edits) {
  const map = edits && typeof edits === "object" && !Array.isArray(edits) ? edits : {};
  const result = [];
  const seen = new Set();
  for (const task of tasks || []) {
    seen.add(task.id);
    const patch = map[task.id];
    if (!patch) {
      result.push(task.local ? task : { ...task, local: "file" });
      continue;
    }
    if (patch === "delete" || patch._op === "delete") continue;
    if (typeof patch === "string") {
      const status = normalizeStatus(patch);
      result.push(status === normalizeStatus(task.status) ? { ...task, local: "file" } : { ...task, status, local: "edited" });
      continue;
    }
    if (typeof patch !== "object") {
      result.push({ ...task, local: "file" });
      continue;
    }
    if (patch._op === "add") {
      const { _op, id, ...rest } = patch;
      result.push(applyTaskPatch(task, rest));
      continue;
    }
    result.push(applyTaskPatch(task, patch));
  }
  for (const [id, patch] of Object.entries(map)) {
    if (seen.has(id) || !patch || typeof patch !== "object" || patch._op !== "add") continue;
    result.push(materializeAdded(id, patch));
  }
  return result;
}

export function pruneEdits(tasks, edits) {
  const byId = new Map((tasks || []).map((task) => [task.id, task]));
  const next = {};
  for (const [id, raw] of Object.entries(edits || {})) {
    if (typeof raw === "string") {
      const task = byId.get(id);
      if (!task) continue;
      const status = normalizeStatus(raw);
      if (status === normalizeStatus(task.status)) continue;
      next[id] = { status };
      continue;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    if (raw._op === "delete") {
      if (byId.has(id)) next[id] = { _op: "delete" };
      continue;
    }
    if (raw._op === "add") {
      if (!cleanString(raw.title)) continue;
      if (byId.has(id)) {
        const patch = diffTask(byId.get(id), materializeAdded(id, raw));
        if (Object.keys(patch).length) next[id] = patch;
        continue;
      }
      next[id] = serializeAdd(id, materializeAdded(id, raw));
      continue;
    }
    const task = byId.get(id);
    if (!task) continue;
    const patch = diffTask(task, applyTaskPatch(task, raw));
    if (Object.keys(patch).length) next[id] = patch;
  }
  return next;
}

export function editCounts(edits) {
  let updated = 0;
  let added = 0;
  let deleted = 0;
  for (const patch of Object.values(edits || {})) {
    if (patch?._op === "add") added += 1;
    else if (patch?._op === "delete") deleted += 1;
    else if (patch && typeof patch === "object") updated += 1;
  }
  return { updated, added, deleted, total: updated + added + deleted };
}

function orderEdits(tasks, edits) {
  const ordered = {};
  for (const task of tasks || []) {
    if (edits[task.id]) ordered[task.id] = edits[task.id];
  }
  for (const [id, patch] of Object.entries(edits || {})) {
    if (!ordered[id]) ordered[id] = patch;
  }
  return ordered;
}

function describeDiff(beforeTask, afterTask, currency) {
  const before = taskSnapshot(beforeTask);
  const after = taskSnapshot(afterTask);
  const parts = [];
  if (before.title !== after.title) parts.push(`title “${after.title}”`);
  if (before.status !== after.status) {
    parts.push(`status ${STATUS_LABELS[before.status]} → ${STATUS_LABELS[after.status]}`);
  }
  if (before.category !== after.category) parts.push(`category ${after.category}`);
  if (before.phase !== after.phase) parts.push(`phase ${after.phase}`);
  if (before.due !== after.due || before.dueMonth !== after.dueMonth) parts.push(`target ${formatDue(after)}`);
  if (before.notes !== after.notes) parts.push(after.notes ? "notes updated" : "notes cleared");
  if (before.vendorTracked !== after.vendorTracked) {
    parts.push(after.vendorTracked ? "tracked as a vendor" : "no longer a vendor booking");
  }
  if (before.vendorName !== after.vendorName) parts.push(after.vendorName ? `vendor ${after.vendorName}` : "vendor cleared");
  if (before.vendorPhone !== after.vendorPhone) parts.push(after.vendorPhone ? "phone updated" : "phone cleared");
  if (before.vendorUrl !== after.vendorUrl) parts.push(after.vendorUrl ? `website ${after.vendorUrl}` : "website cleared");
  if (before.cost !== after.cost) {
    parts.push(after.cost == null ? "quoted cost cleared" : `quoted cost ${formatMoney(after.cost, currency)}`);
  }
  if (before.deposit !== after.deposit) {
    parts.push(after.deposit == null ? "deposit cleared" : `deposit ${formatMoney(after.deposit, currency)}`);
  }
  if (before.balanceDue !== after.balanceDue) {
    const when = parseISODate(after.balanceDue);
    parts.push(when ? `balance due ${formatLongDate(when)}` : "balance due cleared");
  }
  return parts.join("; ") || "details updated";
}

export function summarizeEdits(tasks, edits, currency = "USD", phases = []) {
  const byId = new Map((tasks || []).map((task) => [task.id, task]));
  const phaseTitle = new Map((phases || []).map((phase) => [phase.id, phase.title]));
  const lines = [];
  for (const [id, patch] of Object.entries(orderEdits(tasks, edits))) {
    if (patch?._op === "delete") {
      lines.push(`Removed “${byId.get(id)?.title || id}”.`);
      continue;
    }
    if (patch?._op === "add") {
      const added = materializeAdded(id, patch);
      const phaseLabel = phaseTitle.get(added.phase) || added.phase || "no phase";
      lines.push(`Added “${added.title}” (${added.category}, ${phaseLabel}) · ${STATUS_LABELS[added.status]}.`);
      continue;
    }
    const baseline = byId.get(id);
    if (!baseline || !patch || typeof patch !== "object") continue;
    const applied = applyTaskPatch(baseline, patch);
    lines.push(`Updated “${applied.title}”: ${describeDiff(baseline, applied, currency)}.`);
  }
  return lines;
}

export function buildUpdatePayload(tasks, edits, updatedOn, currency = "USD", phases = [], extras = {}) {
  const changes = orderEdits(tasks, pruneEdits(tasks, edits));
  const summaryLines = summarizeEdits(tasks, changes, currency, phases);
  const document = { updatedOn, changes };
  const lines = [...summaryLines];
  if (extras?.guestPlan) {
    document.guestPlan = extras.guestPlan;
    lines.push("Guest-list edits are in guestPlan. Replace settings-side counts and the households array with this object.");
  }
  const json = JSON.stringify(document, null, 2);
  const body = [
    `Updates from the wedding tracker on ${updatedOn}.`,
    "",
    ...(lines.length ? lines.map((line) => `- ${line}`) : ["- No local edits."]),
    "",
    "Merge `changes` into `data/wedding.json` by task id. See docs/UPDATES.md.",
    "",
    "```json",
    json,
    "```",
    "",
  ].join("\n");
  return {
    title: `Tracker updates ${updatedOn}`,
    body,
    json,
    document,
    summaryLines,
    changes,
  };
}

export function githubIssueUrl({ title, body, repo = ISSUE_REPO, maxUrlLength = MAX_ISSUE_URL_LENGTH }) {
  const base = `https://github.com/${repo}/issues/new`;
  const full = `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  if (full.length <= maxUrlLength) return { url: full, tooLong: false };
  const shortBody = [
    "Updates from the wedding tracker were too long to fit in this link.",
    "",
    "The update JSON was copied to the clipboard. Paste it below this line.",
    "",
    "Merge `changes` into `data/wedding.json` by task id. See docs/UPDATES.md.",
    "",
  ].join("\n");
  return {
    url: `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(shortBody)}`,
    tooLong: true,
  };
}
