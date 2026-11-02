/**
 * Pure rules for the wedding tracker.
 * The page and the node tests both import this file. No build step.
 */

export const STATUS_LABELS = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

/** Sections the nav can open. "all" stacks every section, including the save note. */
export const SECTION_IDS = ["overview", "progress", "timeline", "vendors"];

const HASH_TO_SECTION = {
  overview: "overview",
  progress: "progress",
  timeline: "timeline",
  tasks: "timeline",
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
  if (status === "done" || status === "in-progress" || status === "todo") return status;
  return "todo";
}

export function isOverdue(task, status, today = startOfToday()) {
  if (normalizeStatus(status) === "done") return false;
  const due = resolveDue(task);
  if (!due) return false;
  return due.date.getTime() < today.getTime();
}

export function effectiveStatus(task, overrides) {
  const official = normalizeStatus(task?.status);
  const override = overrides?.[task?.id];
  if (override === "todo" || override === "in-progress" || override === "done") return override;
  return official;
}

/**
 * Checkbox preview. Checking forces "done" in the browser.
 * Unchecking clears that preview, unless the file itself says done —
 * then unchecking previews the task as still to do.
 */
export function previewOverrideForToggle(officialStatus, wantDone) {
  const official = normalizeStatus(officialStatus);
  if (wantDone) return official === "done" ? null : "done";
  return official === "done" ? "todo" : null;
}

export function pruneOverrides(tasks, overrides) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const next = {};
  for (const [id, status] of Object.entries(overrides || {})) {
    const task = byId.get(id);
    if (!task) continue;
    if (status !== "todo" && status !== "in-progress" && status !== "done") continue;
    if (status === normalizeStatus(task.status)) continue;
    next[id] = status;
  }
  return next;
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
      allPast: selected.getTime() < today.getTime(),
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
    allPast: upcoming.length === 0,
  };
}

export function countdownLabel(target) {
  if (!target) return "";
  if (!target.tentative) return "Selected date";
  if (target.allPast) return "Tentative · every candidate date has passed";
  return "Tentative · earliest remaining candidate date";
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
    if (status === "done") done += 1;
    else if (status === "in-progress") inProgress += 1;
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
  return (
    Object.prototype.hasOwnProperty.call(task, "vendorName") ||
    Object.prototype.hasOwnProperty.call(task, "vendorUrl") ||
    Object.prototype.hasOwnProperty.call(task, "cost")
  );
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
    if (raw.status != null && raw.status !== "todo" && raw.status !== "in-progress" && raw.status !== "done") {
      warnings.push(`“${title}” has an unknown status. Use todo, in-progress, or done.`);
    }
    if (Object.prototype.hasOwnProperty.call(raw, "cost") && raw.cost != null && !(typeof raw.cost === "number" && Number.isFinite(raw.cost))) {
      warnings.push(`“${title}” cost should be a number or null, with no currency symbol.`);
    }

    const due = typeof raw.due === "string" ? raw.due.trim() : "";
    const dueMonth = typeof raw.dueMonth === "string" ? raw.dueMonth.trim() : "";
    const dueOk = (due && parseISODate(due)) || (dueMonth && parseDueMonth(dueMonth));
    if ((due || dueMonth) && !dueOk) {
      warnings.push(`“${title}” has a due value that is not YYYY-MM-DD or YYYY-MM.`);
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
      cost: typeof raw.cost === "number" && Number.isFinite(raw.cost) ? raw.cost : null,
    };
  });

  if (settings.selectedDate != null && settings.selectedDate !== "" && !parseISODate(settings.selectedDate)) {
    warnings.push("settings.selectedDate needs to be null or a YYYY-MM-DD date. The countdown is using a candidate date instead.");
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

  return { settings, phases, tasks, warnings };
}
