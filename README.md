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
| Timeline | `#timeline` | Phases, filters, and editable items |
| Vendors | `#vendors` | Bookings, the shortlist, tray carriers, and the budget, including the $50,000 plan |

**View all sections**, the control directly under the nav, stacks every section the way the long page used to, and sets `#all`. In that mode that control is the one marked current. Otherwise the open section’s nav link is marked current (`aria-current="page"`).

Back, forward, and a copied link open the same view. `#tasks` still opens the timeline. With no hash, the page opens on Countdown. Local edits stay in this browser while you move between sections.

## Publish with GitHub Pages

1. Merge this project to the `main` branch.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch **`main`** and folder **`/ (root)`**.
5. Save.

GitHub will publish the site at `https://victorv83.github.io/Wedding-Planner/`. The root [`.nojekyll`](.nojekyll) file tells Pages to serve the files as they are. Paths are relative, so the same folder also works if the site is hosted at a domain root.

After you edit `data/wedding.json` on `main`, wait for the Pages deployment to finish, then reload. Browsers and GitHub may cache the JSON for a short time.

## How to update

Official status is the `status` field in `data/wedding.json`. The page can also keep edits in this browser, layered on top of that file, until you send them.

### Edits on the page

On the timeline, **Edit** opens the item: title, category, phase, status, target date, and notes. Vendor bookings also have a contact name, phone or website, quoted cost, deposit, and balance due date. **Save** writes this browser only. **Cancel** discards the form. **Add item** and **Delete** (after a confirm) work the same way. **Mark done** is a shortcut that sets status to `done`, or restores the file status if you clear it.

Statuses are `todo` (shown as Not started), `researching`, `contacted`, `booked`, and `done`. `booked` and `done` both count as complete. `researching`, `contacted`, and the older `in-progress` value count as underway. Progress bars, the next open target, filters, overdue flags, and the vendor and cost table all follow these edits. An item with unsent edits shows an **Unsent** or **New** badge.

**Send updates** (in the header and on the timeline) opens a GitHub issue titled `Tracker updates YYYY-MM-DD`. The body is a short summary plus a fenced JSON block of the changes, keyed by task id. **Copy updates** and **Download JSON** are there if the link is awkward. Very long updates are copied to the clipboard instead of being stuffed into the URL; paste that JSON into the issue. After you open the draft, keep the edits on this device until `data/wedding.json` is updated, then use **Reset local edits**.

The JSON shape and the merge steps are in [`docs/UPDATES.md`](docs/UPDATES.md). The page never writes the file itself, and it does not use a token.

Nothing typed here should be a personal phone number or a home address. The repository is public. A vendor’s business line or website is the only contact detail the form is for, and it will be in the GitHub issue if you send it.

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
| `idealDate` | The preferred Saturday while you are still deciding, or `null`. The countdown uses it and labels it **Tentative · ideal date**. |
| `candidateDates` | Array of `YYYY-MM-DD` Saturdays still in the running, including the ideal date. The others are shown as alternatives. |
| `selectedDate` | The chosen Saturday, or `null` if you have not decided. This overrides `idealDate` and the label becomes **Selected date**. |
| `guestCount` | A number, or `null`. |
| `budget` | Target in `currency`. The seed target is `50000`. No `$` in the JSON. |
| `currency` | ISO code, default `USD`. |
| `tetDate` / `tetLabel` | Shown as a fact next to guests and budget. |

When `selectedDate` is `null` and `idealDate` is set, the countdown uses that ideal Saturday and labels it **Tentative · ideal date**. The other dates in `candidateDates` are listed as alternatives. If `idealDate` is also null, the countdown falls back to the earliest candidate that is still today or in the future and labels it **Tentative · earliest remaining candidate date**. Set `selectedDate` to one of those Saturdays (or any other `YYYY-MM-DD`) once you decide. The label then changes to **Selected date**.

```json
"idealDate": "2028-03-18",
"selectedDate": null,
"guestCount": 160,
"budget": 40000
```

The ideal date is Saturday, March 18, 2028. The alternatives are Saturday, February 5, 2028 and Saturday, February 19, 2028. Saturday, March 4, 2028 is not in the running. Tết Nguyên Đán 2028 is January 26, so each listed date falls after the holiday.

Invitation mailing and the final-detail deadlines keep the same lead time they had before a February 5 wedding. Mailing is January 16, 2028 (it was December 5, 2027). The last ceremony tasks run through March 2, 2028.

### Tasks

Each object in `tasks` has:

| Field | Meaning |
| --- | --- |
| `id` | Stable id, unique in the file. Local edits and update issues use it as the key. |
| `title` | Short task name. |
| `category` | Free text. New categories show up in the filter and the category bars. |
| `phase` | Must match an `id` in `phases` to land in that timeline group. |
| `due` | Optional exact date, `YYYY-MM-DD`. |
| `dueMonth` | Optional due-by month, `YYYY-MM`. The task is due at the end of that month. If both are set, `due` wins. |
| `status` | `todo` (not started), `researching`, `contacted`, `booked`, `done`, or the older `in-progress`. Booked and done are complete. |
| `notes` | Plain text. Line breaks are kept. |
| `vendorName` | Optional. `null` means not chosen yet. |
| `vendorUrl` | Optional `https://` link, or `null`. |
| `vendorPhone` | Optional business phone, or `null`. Do not put a personal number in this public repo. |
| `cost` | Optional quoted cost as a number, or `null`. |
| `deposit` | Optional deposit already paid, as a number, or `null`. |
| `balanceDue` | Optional `YYYY-MM-DD` date the remaining balance is due, or `null`. |

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

### Budget, shortlist, and venue rules

`budgetEstimate` is the table on the Vendors page. Each line is `flat + perGuest × guests`, with a low and a high, priced at 175 and 250 guests. `group` is `wedding` (in the total), `optional`, or `parties`. Bachelor and bachelorette costs are `parties` and are not in the wedding total. `contingencyPercent` adds 10–15% for tax, tips, and fees. `priceType` is `listed` only when a vendor or directory published the number.

`target` is `50000`. The page compares the 175- and 250-guest totals with that target and shows the per-guest ceiling at 175, 200, and 250. `plan` is the **Plan to hit $50k** column for about 200 guests. It prices the bar twice — bring-your-own alcohol with a licensed bartender, and a venue bar package — and the cautious total is the higher one. A line is marked over the allocation when the researched range does not fit that choice.

`vendorOptions` is the shortlist, not a booking. Venue candidates include `byoAlcohol` (`yes`, `bartender`, `no`, or `unknown`) and `outsideCatering` (`yes`, `approved`, `no`, or `unknown`), plus `policySource` when a page states the rule. The same two fields are on venue tasks, so the timeline editor can change them. `weddingParty` is 4 bridesmaids and 4 groomsmen, and the extra carriers needed for 5 or 7 mâm quả trays.

The tea ceremony is at a family home, so that place is `$0`. Decor, rentals, flowers, and the photographer still have lines. The student sax task is an estimate for about an hour.

### Phases already in the file

| `id` | When | What belongs there |
| --- | --- | --- |
| `now` | Now – January 2027 | Rough guest count, choose the date, reception venue, tea ceremony location, caterer |
| `early-2027` | Early 2027 | Planner, local photo and video, officiant, confirm Tuấn, DJ or band, student sax |
| `spring-summer-2027` | Spring – summer 2027 | Catering tasting, hair and makeup, florist, rentals, bar, tray carriers |
| `vietnam-2027` | September 2027 | Dress, áo dài, and suit fittings; pre-wedding photos; print bilingual invitations |
| `autumn-2027` | October – November 2027 | Alterations at home, cake, transportation, hotel block |
| `final` | January – early March 2028 | Mail invitations, bachelor hiking trip (before Tết), bachelorette weekend, license, ceremony details, RSVPs |

The seed list follows a common vendor booking order (venue, planner, attire, photo and video, catering, officiant, MC and music, hair and makeup, flowers, cake, invitations, transportation, then ceremony details), placed into those windows. The Vietnam trip in September 2027 is for the pre-wedding photo shoot, fittings, and printing invitations.

A task is **overdue** when its due date, or the last day of its due month, is before today and the status on screen is not `booked` or `done`. Overdue cards say **Overdue**; color is not the only signal.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Layout and the lacquer, gold, and ivory styling |
| `app.js` | Loads the JSON and draws the page |
| `logic.js` | Date, progress, vendor, and local-edit rules |
| `data/wedding.json` | The plan |
| `docs/UPDATES.md` | How an assistant applies a tracker-update issue |
| `favicon.svg` | Tab icon |
| `.nojekyll` | Disables Jekyll on GitHub Pages |

`node --test` runs `tests/tracker.test.mjs` against those rules and the seed file. The site itself does not need Node.
