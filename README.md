# Wedding plans

A static planning tracker for **Victor & Mít**, a Vietnamese–American wedding with a traditional tea ceremony (lễ gia tiên) and a reception near Orange and Beaumont, Texas. The page is plain HTML, CSS, and JavaScript. GitHub Pages can serve it from the `main` branch with no build step and no backend.

The couple’s display name, dates, guest count, budget, and every task live in one file: [`data/wedding.json`](data/wedding.json). The heading is **Victor & Mít**, from `settings.coupleDisplayName`.

Nothing on this site asks for an address, phone number, or email. The repository is public. Keep it that way: do not add contact details, street addresses, or other private information to the JSON file or the page.

## See it locally

Opening `index.html` as a file will not load the checklist, because the browser blocks `fetch` on `file://` URLs. Serve the folder instead:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>.

## Moving around the page

The HTML, CSS, scripts, and `data/wedding.json` load once. After that, the section nav swaps only the area under it. Nothing is fetched again, and the page does not reload.

| Nav | Hash | What you see |
| --- | --- | --- |
| Countdown | `#overview` | Date countdown and the guest, budget, and Tết facts |
| Progress | `#progress` | Overall, phase, and category bars |
| Timeline | `#timeline` | Phases, filters, and the preview checkboxes |
| Vendors | `#vendors` | Vendor and cost table |

**View all sections**, the control directly under the nav, stacks every section the way the long page used to, and sets `#all`. In that mode that control is the one marked current. Otherwise the open section’s nav link is marked current (`aria-current="page"`).

Back, forward, and a copied link open the same view. `#tasks` still opens the timeline. With no hash, the page opens on Countdown. Preview checkboxes stay in this browser while you move between sections.

## Publish with GitHub Pages

1. Merge this project to the `main` branch.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch **`main`** and folder **`/ (root)`**.
5. Save.

GitHub will publish the site at `https://victorv83.github.io/Wedding-Planner/`. The root [`.nojekyll`](.nojekyll) file tells Pages to serve the files as they are. Paths are relative, so the same folder also works if the site is hosted at a domain root.

After you edit `data/wedding.json` on `main`, wait for the Pages deployment to finish, then reload. Browsers and GitHub may cache the JSON for a short time.

## How to update

Official status is the `status` field in `data/wedding.json`. The checkboxes labeled **Preview as done** are a local rehearsal: they live in this browser’s `localStorage` and are not written back to the file. **Reset preview** clears them. Progress bars, the vendor table’s status column, and the phase totals follow the file. The timeline badges follow the preview when a checkbox is set, and they label that state **Preview** plus the saved status.

### Edit on GitHub

1. Open [`data/wedding.json`](data/wedding.json).
2. Click the pencil (**Edit this file**).
3. Change the fields you need. Keep the file valid JSON: double quotes, no comments, no trailing commas.
4. Commit to `main` (or open a pull request if you want a review first).
5. Reload the site after Pages finishes deploying.

UTF-8 is required so Vietnamese diacritics stay intact (`lễ gia tiên`, `áo dài`, `mâm quả`, `Tết Nguyên Đán`, `Tuấn`, `Mít`).

### Settings

| Field | Meaning |
| --- | --- |
| `coupleDisplayName` | Heading and browser title. The seed value is `Victor & Mít`. |
| `vietnameseSubtitle` | Line under the names, shown with `lang="vi"`. |
| `celebration` | Short description under the subtitle. |
| `place` | Region line. Keep it general. |
| `candidateDates` | Array of `YYYY-MM-DD` Saturdays still in the running. |
| `selectedDate` | The chosen Saturday, or `null` if you have not decided. |
| `guestCount` | A number, or `null`. |
| `budget` | A number in `currency`, or `null`. No `$` in the JSON. |
| `currency` | ISO code, default `USD`. |
| `tetDate` / `tetLabel` | Shown as a fact next to guests and budget. |

When `selectedDate` is `null`, the countdown uses the earliest candidate date that is still today or in the future, and the page labels it **Tentative · earliest remaining candidate date**. The full candidate list stays on the page. Set `selectedDate` to one of those Saturdays (or any other `YYYY-MM-DD`) once you decide. The label then changes to **Selected date**.

```json
"selectedDate": "2028-02-05",
"guestCount": 160,
"budget": 40000
```

The seed candidates are Saturday, February 5, 2028; Saturday, February 19, 2028; and Saturday, March 18, 2028. Tết Nguyên Đán 2028 is January 26, so each candidate falls after the holiday.

### Tasks

Each object in `tasks` has:

| Field | Meaning |
| --- | --- |
| `id` | Stable id, unique in the file. Used by the browser preview. |
| `title` | Short task name. |
| `category` | Free text. New categories show up in the filter and the category bars. |
| `phase` | Must match an `id` in `phases` to land in that timeline group. |
| `due` | Optional exact date, `YYYY-MM-DD`. |
| `dueMonth` | Optional due-by month, `YYYY-MM`. The task is due at the end of that month. If both are set, `due` wins. |
| `status` | `todo`, `in-progress`, or `done`. |
| `notes` | Plain text. Line breaks are kept. |
| `vendorName` | Optional. `null` means not chosen yet. |
| `vendorUrl` | Optional `https://` link, or `null`. |
| `cost` | Optional number, or `null`. |

A task appears in the vendor table when it includes `vendorName`, `vendorUrl`, or `cost` (use `null` while the vendor is unknown). Omit all three for tasks that are decisions rather than bookings. The **Known costs** total adds only numeric `cost` values and skips blanks.

```json
{
  "id": "mc",
  "title": "Confirm Tuấn as MC",
  "category": "Music & MC",
  "phase": "early-2027",
  "due": "2027-02-28",
  "status": "in-progress",
  "notes": "Confirm that Tuấn can MC.",
  "vendorName": "Tuấn",
  "vendorUrl": null,
  "cost": null
}
```

Within a phase, tasks stay in the order they appear in the file. To reorder, move the whole object. Unknown phase ids are grouped at the end under **Other**.

### Phases already in the file

| `id` | When | What belongs there |
| --- | --- | --- |
| `now` | Now – January 2027 | Rough guest count, choose the date, reception venue, tea ceremony location, caterer |
| `early-2027` | Early 2027 | Planner, local photo and video, officiant, confirm Tuấn, DJ or band |
| `spring-summer-2027` | Spring – summer 2027 | Catering tasting, hair and makeup, florist and altar decor |
| `vietnam-2027` | September 2027 | Dress, áo dài, and suit fittings; pre-wedding photos; print bilingual invitations |
| `autumn-2027` | October – November 2027 | Alterations at home, cake, transportation, mail invitations by early December |
| `final` | December 2027 – January 2028 | Elder spokespeople, optional lion dance, mâm quả, tea set, ceremony jewelry, RSVPs |

The seed list follows a common vendor booking order (venue, planner, attire, photo and video, catering, officiant, MC and music, hair and makeup, flowers, cake, invitations, transportation, then ceremony details), placed into those windows. The Vietnam trip in September 2027 is for the pre-wedding photo shoot, fittings, and printing invitations.

A task is **overdue** when its due date, or the last day of its due month, is before today and the status on screen is not `done`. Overdue cards say **Overdue**; color is not the only signal.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Layout and the lacquer, gold, and ivory styling |
| `app.js` | Loads the JSON and draws the page |
| `logic.js` | Date, progress, and vendor rules |
| `data/wedding.json` | The plan |
| `favicon.svg` | Tab icon |
| `.nojekyll` | Disables Jekyll on GitHub Pages |

`node --test` runs `tests/tracker.test.mjs` against those rules and the seed file. The site itself does not need Node.
