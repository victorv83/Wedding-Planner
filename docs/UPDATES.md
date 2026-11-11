# Applying tracker updates

The wedding page does not write `data/wedding.json`. Edits stay in the browser. **Send updates** opens a GitHub issue whose body contains one fenced `json` block. Merge that block into `data/wedding.json`, commit it, and tell the couple they can use **Reset local edits** after the page reloads with the new file.

The block is an object:

```json
{
  "updatedOn": "2026-11-03",
  "changes": {
    "venue-reception": {
      "status": "booked",
      "vendorName": "Example Hall",
      "vendorUrl": "https://example.com",
      "cost": 12000,
      "deposit": 2000,
      "balanceDue": "2027-06-01",
      "due": "2027-01-20",
      "dueMonth": ""
    },
    "photo-extra": {
      "_op": "add",
      "id": "photo-extra",
      "title": "Book a second photographer",
      "category": "Photo & video",
      "phase": "early-2027",
      "status": "researching",
      "notes": "",
      "due": "2027-04-15",
      "dueMonth": "",
      "vendorTracked": true,
      "vendorName": null,
      "vendorUrl": null,
      "vendorPhone": null,
      "cost": null,
      "deposit": null,
      "balanceDue": null
    },
    "lion": { "_op": "delete" }
  }
}
```

`updatedOn` is the day the issue was created. `changes` is keyed by task `id`. If `guestPlan` is present, replace the guest-plan object in `data/wedding.json` with it. If `quotes` is present, it is keyed by vendor id (`amount`, `deposit`, `quotedOn`, `holdDeadline`, `notes`). A quote amount replaces that task's budget estimate until you write the number into the plan. If `nextActions` is present, `true` means that checklist item was checked. If `cateringUnit` is `per-person` or `per-table`, that is the Kim Sơn scenario selected on the device. Ignore any prose around the fence; the object is the source of truth. If the issue says the JSON was copied to the clipboard, use the pasted object, which has the same shape.

## Merge rules

1. Parse the fenced JSON. If the fence is missing, parse the pasted object.
2. For each entry in `changes`:
   - `"_op": "delete"` — remove the task with that id. Leave the rest of the file alone.
   - `"_op": "add"` — create a task whose `id` is the object key (and the `id` field, which match). Drop `_op`. Insert it after the last task that uses the same `phase`, or at the end of `tasks` if that phase is new.
   - Any other object — update the existing task with that id. Copy only the keys that are present. Do not change keys the object omits.
3. Keep `settings` and `phases` as they are unless a new task uses an unknown phase id. If it does, add a phase or move the task to an existing one, and mention that in the commit.
4. Keep task order except for the insert in an add. Do not reorder unrelated tasks.
5. Preserve UTF-8. Do not escape Vietnamese letters (`lễ gia tiên`, `áo dài`, `mâm quả`, `Tết Nguyên Đán`, `Tuấn`, `Mít`).

Empty string `""` on `due` or `dueMonth` clears that field. You may delete the key instead. If both are set, `due` is the date the page shows.

`null` clears `vendorName`, `vendorUrl`, `vendorPhone`, `cost`, `deposit`, and `balanceDue`. Keep the key with `null` when the task stays a vendor booking.

`vendorTracked: false` means the task is no longer a booking. Remove `vendorName`, `vendorUrl`, `vendorPhone`, `cost`, `deposit`, `balanceDue`, and `vendorTracked`.

`vendorTracked: true` means it is a booking. Make sure `vendorName`, `vendorUrl`, and `cost` exist, using `null` when this change does not give a value. Apply any vendor fields included in the same object.

## Fields

| Key | Value |
| --- | --- |
| `title` | One line. |
| `category` | Free text. |
| `phase` | A phase `id` from the file. |
| `status` | `todo`, `researching`, `contacted`, `booked`, `done`, or legacy `in-progress`. |
| `notes` | String. Line breaks are fine. |
| `due` | `YYYY-MM-DD`, or `""` to clear. |
| `dueMonth` | `YYYY-MM`, or `""` to clear. |
| `vendorName` | String or `null`. |
| `vendorPhone` | Business phone or `null`. Never add a personal number. |
| `vendorUrl` | `http://` or `https://` URL, or `null`. |
| `cost` | Quoted cost as a number, or `null`. No currency symbol. |
| `deposit` | Amount already paid, or `null`. |
| `balanceDue` | `YYYY-MM-DD` or `null`. |
| `byoAlcohol` | On venue tasks only: `yes`, `bartender`, `no`, or `unknown`. |
| `outsideCatering` | On venue tasks only: `yes`, `approved`, `no`, or `unknown`. |

`todo` is not started. `researching`, `contacted`, and `in-progress` are underway. `booked` and `done` are complete: they fill the progress bars and they are not overdue.

A task is a vendor row when it has any of `vendorName`, `vendorUrl`, `vendorPhone`, `cost`, `deposit`, or `balanceDue`. Those rows appear in the cost table. Only numeric `cost` values are added into the total.

## After the file is updated

Commit `data/wedding.json`. When GitHub Pages has published it, the couple reloads and clicks **Reset local edits** so this browser stops layering the old changes on the new file.
