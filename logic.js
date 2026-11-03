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

  return { settings, phases, tasks, warnings };
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

export function buildUpdatePayload(tasks, edits, updatedOn, currency = "USD", phases = []) {
  const changes = orderEdits(tasks, pruneEdits(tasks, edits));
  const summaryLines = summarizeEdits(tasks, changes, currency, phases);
  const document = { updatedOn, changes };
  const json = JSON.stringify(document, null, 2);
  const body = [
    `Updates from the wedding tracker on ${updatedOn}.`,
    "",
    ...(summaryLines.length ? summaryLines.map((line) => `- ${line}`) : ["- No local edits."]),
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
