import {
  guestSideTotal,
  guestTablePlan,
  monthsInRange,
  tasksInMonth,
} from "./logic.js";

const GUEST_KEY = "weddingPlanner.guestPlan.v1";

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

export function loadGuestEdits() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGuestEdits(edits) {
  try {
    if (!edits) localStorage.removeItem(GUEST_KEY);
    else localStorage.setItem(GUEST_KEY, JSON.stringify(edits));
  } catch {
    /* In-memory edits still work for this visit. */
  }
}

export function applyGuestEdits(base, edits) {
  const plan = {
    target: base?.target || 200,
    tableSize: base?.tableSize || 10,
    sides: (base?.sides || []).map((side) => ({ ...side })),
    households: (base?.households || []).map((house) => ({ ...house })),
  };
  if (!edits) return plan;
  if (Array.isArray(edits.sides)) {
    plan.sides = plan.sides.map((side) => {
      const next = edits.sides.find((item) => item.id === side.id);
      return next ? { ...side, estimate: Number(next.estimate) || 0 } : side;
    });
  }
  if (Array.isArray(edits.households)) plan.households = edits.households.map((house) => ({ ...house }));
  return plan;
}

export function guestEditsDirty(base, edits) {
  if (!edits) return false;
  const applied = applyGuestEdits(base, edits);
  return JSON.stringify(applied) !== JSON.stringify(applyGuestEdits(base, null));
}

function fold(title, children) {
  return el("details", { class: "guide-fold" }, [
    el("summary", { text: title }),
    el("div", { class: "guide-fold-body" }, children),
  ]);
}

function gallery(images) {
  return el("div", { class: "gallery" }, (images || []).map((image) => el("figure", {}, [
    el("img", {
      src: image.src,
      alt: image.alt || image.caption || "Reference photo",
      loading: "lazy",
      decoding: "async",
      width: "640",
      height: "480",
    }),
    el("figcaption", { text: image.caption }),
  ])));
}

function taskLink(taskId, tasks) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return taskId;
  const link = el("a", { href: "#timeline", text: task.title });
  return link;
}

export function renderCeremony(guides, tasks) {
  const guide = guides.ceremony;
  const section = el("section", { class: "section", id: "ceremony", "aria-labelledby": "ceremony-heading" }, [
    el("h2", { id: "ceremony-heading", text: "Tea ceremony" }),
    el("p", { class: "hint", text: guide.intro }),
    fold("Photos: áo dài and a fruit tray", [gallery(guides.galleries.ceremony), el("p", { class: "hint", text: "The fruit photo is a Tết tray, not a full set of betrothal trays. Full credits are in docs/IMAGE_CREDITS.md." })]),
    el("div", { class: "panel" }, [
      el("h3", { class: "subhead", text: "A draft order" }),
      el("ol", { class: "guide-list" }, guide.order.map((step) => el("li", {}, [
        el("strong", { text: step.title }),
        " ",
        step.detail,
      ]))),
    ]),
    el("div", { class: "panel" }, [
      el("h3", { class: "subhead", text: "Trays" }),
      el("ul", { class: "guide-list" }, guide.trays.map((tray) => el("li", {}, [
        el("strong", { text: tray.item }),
        " ",
        tray.note,
      ]))),
    ]),
    el("div", { class: "panel" }, [
      el("h3", { class: "subhead", text: "Setup at the house" }),
      el("ul", { class: "guide-list" }, guide.setup.map((item) => el("li", {}, [
        item.item,
        " · ",
        taskLink(item.taskId, tasks),
      ]))),
      el("p", { text: guide.morning }),
    ]),
  ]);
  return section;
}

export function renderGuests(basePlan, edits, onChange) {
  const plan = applyGuestEdits(basePlan, edits);
  const total = guestSideTotal(plan);
  const tables = guestTablePlan(plan);
  const gap = total - plan.target;
  const sideInputs = plan.sides.map((side) => {
    const input = el("input", { type: "number", min: "0", inputmode: "numeric", "aria-label": side.label });
    input.value = String(side.estimate);
    input.addEventListener("change", () => {
      const sides = plan.sides.map((item) => item.id === side.id ? { ...item, estimate: Number(input.value) || 0 } : item);
      onChange({ ...edits, sides, households: plan.households });
    });
    return el("label", { class: "field" }, [el("span", { class: "field-label", text: side.label }), input]);
  });

  const houseNodes = plan.households.map((house, index) => {
    const name = el("input", { type: "text", value: house.name || "", "aria-label": "Household name", autocomplete: "off" });
    name.value = house.name || "";
    const count = el("input", { type: "number", min: "1", value: String(house.count || 1), "aria-label": "People" });
    count.value = String(house.count || 1);
    const side = el("select", { "aria-label": "Side" }, plan.sides.map((item) => el("option", { value: item.id, text: item.label })));
    side.value = house.side || plan.sides[0]?.id || "";
    const rsvp = el("select", { "aria-label": "RSVP" }, ["unknown", "yes", "no", "maybe"].map((value) => el("option", { value, text: value })));
    rsvp.value = house.rsvp || "unknown";
    const table = el("input", { type: "number", min: "1", max: String(tables.tables || 20), "aria-label": "Table", placeholder: "Table" });
    table.value = house.table ? String(house.table) : "";
    const notes = el("input", { type: "text", "aria-label": "Note", autocomplete: "off" });
    notes.value = house.notes || "";
    const write = () => {
      const households = plan.households.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        name: name.value.trim(),
        count: Number(count.value) || 1,
        side: side.value,
        rsvp: rsvp.value,
        table: table.value ? Number(table.value) : null,
        notes: notes.value.trim(),
      } : item);
      onChange({ sides: plan.sides, households });
    };
    [name, count, side, rsvp, table, notes].forEach((node) => node.addEventListener("change", write));
    const remove = el("button", { type: "button", class: "danger text-button", text: "Remove" });
    remove.addEventListener("click", () => {
      const households = plan.households.filter((_, itemIndex) => itemIndex !== index);
      onChange({ sides: plan.sides, households });
    });
    return el("div", { class: "household" }, [name, count, side, rsvp, table, notes, remove]);
  });

  const add = el("button", { type: "button", text: "Add a household" });
  add.addEventListener("click", () => {
    const households = [...plan.households, {
      id: `house-${Date.now()}`,
      name: "",
      count: 2,
      side: plan.sides[0]?.id || "victor",
      rsvp: "unknown",
      table: null,
      notes: "",
    }];
    onChange({ sides: plan.sides, households });
  });

  const seats = Array.from({ length: tables.tables }, (_, index) => {
    const number = index + 1;
    const names = plan.households.filter((house) => Number(house.table) === number);
    const used = names.reduce((sum, house) => sum + (Number(house.count) || 0), 0);
    return el("li", {}, [
      el("strong", { text: `Table ${number}` }),
      ` · ${used} / ${tables.size}`,
      names.length ? ` · ${names.map((house) => house.name || "Unnamed").join(", ")}` : " · empty",
    ]);
  });

  return el("section", { class: "section", id: "guests", "aria-labelledby": "guests-heading" }, [
    el("h2", { id: "guests-heading", text: "Guest list" }),
    el("p", { class: "hint", text: "The planning baseline is about 200 guests, seated as 20 tables of 10. The side counts are estimates, not a finished list. Nothing here is sent until you use Send updates." }),
    el("div", { class: "panel" }, [
      el("h3", { class: "subhead", text: "Sides" }),
      el("div", { class: "field-row side-grid" }, sideInputs),
      el("p", {}, [
        el("strong", { text: `${total} estimated` }),
        total === plan.target ? " · matches the baseline of 200." : ` · ${Math.abs(gap)} ${gap > 0 ? "over" : "under"} the baseline of ${plan.target}.`,
      ]),
    ]),
    el("div", { class: "panel" }, [
      el("h3", { class: "subhead", text: "Households and RSVPs" }),
      el("p", { class: "hint", text: `${tables.assigned} people assigned on the list · ${tables.tables} tables · ${tables.seats} seats. Add real households when you are ready.` }),
      el("div", { class: "households" }, houseNodes),
      add,
    ]),
    el("div", { class: "panel" }, [
      el("h3", { class: "subhead", text: "Tables" }),
      el("ol", { class: "guide-list table-plan" }, seats),
    ]),
  ]);
}

export function renderOutreach(guides, tasks) {
  const blocks = guides.outreach.map((group) => fold(group.title, [
    el("p", { class: "hint" }, ["Timeline: ", taskLink(group.taskId, tasks)]),
    el("ul", { class: "guide-list" }, group.questions.map((question) => el("li", { text: question }))),
    el("p", { class: "hint", text: "Draft only. Nothing on this page sends email." }),
    el("pre", { class: "email-draft" }, [group.email]),
    copyButton(group.email),
  ]));
  return el("section", { class: "section", id: "outreach", "aria-labelledby": "outreach-heading" }, [
    el("h2", { id: "outreach-heading", text: "Vendor outreach drafts" }),
    el("p", { class: "hint", text: "Labeled drafts you can copy. Nothing on this page is sent. Addresses are public business contacts. A personal reply-to is left off on purpose. Do not assume a hall allows bring-your-own alcohol." }),
    ...blocks,
  ]);
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function copyButton(text) {
  const button = el("button", { type: "button", text: "Copy draft" });
  button.addEventListener("click", async () => {
    button.textContent = (await writeClipboard(text)) ? "Copied" : "Copy failed";
  });
  return button;
}

export function renderMonths(guides, tasks) {
  const months = monthsInRange("2026-11", "2028-03");
  const blocks = months.map((month) => {
    const due = tasksInMonth(tasks, month);
    const note = guides.monthNotes?.[month];
    const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${month}-02T00:00:00`));
    return el("section", { class: "month-block", "aria-labelledby": `month-${month}` }, [
      el("h3", { id: `month-${month}`, text: label }),
      note ? el("p", { text: note }) : null,
      due.length
        ? el("ul", { class: "guide-list" }, due.map((task) => el("li", {}, [taskLink(task.id, tasks)])))
        : el("p", { class: "hint", text: "No task is due this month." }),
    ]);
  });
  return el("section", { class: "section", id: "months", "aria-labelledby": "months-heading" }, [
    el("h2", { id: "months-heading", text: "Month by month" }),
    el("p", { class: "hint", text: "From November 2026 to March 18, 2028. These are the same timeline items, grouped by due month, plus a few notes. Save-the-dates are not a separate task." }),
    fold("Vietnam trip ideas, September 2027", [
      el("p", { text: "The booked work that month is fittings, a pre-wedding photo shoot, and printed invitations. Hội An, Đà Lạt, and Saigon are places people photograph, not a reserved itinerary." }),
      gallery(guides.galleries.vietnam),
    ]),
    ...blocks,
  ]);
}

export function renderDayOf(guides) {
  return el("section", { class: "section", id: "dayof", "aria-labelledby": "dayof-heading" }, [
    el("h2", { id: "dayof-heading", text: "Day of" }),
    el("p", { class: "hint", text: "A draft run of show for Saturday, March 18, 2028. February 5 and February 19 are still alternatives. Clock times are a guess until the families and the hall confirm them." }),
    fold("Reception inspiration", [
      el("p", { text: "Red and gold, lanterns, and a double-happiness mark are ideas for the florist and rentals conversation. The lantern photo is from Taiwan, and the lion photo is from New York. Neither is this wedding." }),
      el("p", { class: "happiness", lang: "zh", text: "囍" }),
      gallery(guides.galleries.reception),
    ]),
    el("ol", { class: "run-list" }, guides.runOfShow.map((item) => el("li", {}, [
      el("time", { text: item.time }),
      el("div", {}, [
        el("strong", { text: item.title }),
        el("p", { text: item.detail }),
      ]),
    ]))),
  ]);
}
