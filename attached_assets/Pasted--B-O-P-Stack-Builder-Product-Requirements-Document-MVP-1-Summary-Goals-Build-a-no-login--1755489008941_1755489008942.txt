# B.O.P Stack Builder — Product Requirements Document (MVP)

## 1) Summary & Goals
Build a no‑login Replit web app that helps a field user assemble a Blowout Preventer (B.O.P) stack and generate a downloadable PDF report. The app guides the user through selecting parts, narrowing options from flange specs, and automatically fills ring type, wrench number, truck unit PSI, bolt count, flange size, and bolt size from the uploaded dataset.

**Primary goals**
- Accurate, step‑by‑step part selection using the provided flange database (CSV/XLSX).
- Autogenerate final specs for each selected part.
- Allow drag‑and‑drop stack ordering.
- Export a clean, printable PDF.

**Non‑goals (MVP)**
- User authentication.
- Multi‑tenant organization management.
- Offline mode.

---

## 2) Data Source & Ground Truth
**Source files:** `Common Flanges` & `Size Scale` sheets in the provided spreadsheet.

**Key columns (from *Common Flanges*):**
- `Flange size` (e.g., `13-5/8 10M`) — composite of nominal size and pressure class.
- `# of bolts` (integer)
- `Size of bolts` (free‑text, e.g., `1-7/8 × 17-1/2`)
- `Wrench` (integer)
- `Truck Unit PSI` (integer)
- `Ring needed` (e.g., `BX-160`, `R-37 or RX-37`)
- `Annular Pressure` (optional numeric)
- `Single B.O.P (RAM)` (optional numeric)
- `Double B.O.P (Double Rams)` (optional numeric)
- `Mud Cross` (optional numeric)

**Key columns (from *Size Scale*):**
- `Wrench #`, `Stud diameter (inches)`, `Truck Unit PSI setting` — used as a fallback/verification map when needed.

**Derived pressure options present in data:**
- **Annular:** 5,000; 10,000 PSI
- **Single B.O.P (RAM):** 5,000; 10,000 PSI
- **Double B.O.P (Double Rams):** 5,000; 10,000 PSI
- **Mud Cross:** 10,000 PSI

> Note: These were extracted from the uploaded sheet and should be treated as the canonical options displayed in the UI. If future CSV uploads add more pressures, the UI should expand automatically.

---

## 3) Personas & Scenarios
- **Field Tech (primary):** Needs to rapidly assemble a stack from known parts and site constraints and generate a spec report to hand to the crew.
- **Dispatcher/Back‑office (secondary):** Validates the selections, prints the PDF, archives it to a job folder.

---

## 4) Core User Flow
1. **Start** → prompt: *“What would you like to add to your B.O.P stack?”*
   - Choices (multi‑add, one at a time): **Annular**, **Single B.O.P (RAM)**, **Double B.O.P (RAMs)**, **Mud Cross**, **Anaconda Lines**, **Rotating Head**, **Adapter Spool**.

2. **Branch A — Pressure‑driven parts** (Annular, Single RAM, Double RAMs, Mud Cross)
   - Q1: *“What is the pressure of your part?”* (dropdown sourced from data for that part type)
   - System filters the **Common Flanges** rows to those that match:
     - For `Annular` → rows where `Annular Pressure` equals the chosen pressure.
     - For `Single B.O.P (RAM)` → rows where `Single B.O.P (RAM)` equals the chosen pressure.
     - For `Double B.O.P (Double Rams)` → rows where `Double B.O.P (Double Rams)` equals the chosen pressure.
     - For `Mud Cross` → rows where `Mud Cross` equals the chosen pressure.
   - If multiple flange rows remain, user then narrows by **Flange size** (drop‑down), else the system selects uniquely.
   - Once a unique row is identified, system **finalizes** and stores: `Ring needed`, `Truck Unit PSI`, `Wrench`, `# of bolts`, `Flange size`, `Size of bolts`.

3. **Branch B — Geometry‑driven parts** (Anaconda Lines, Rotating Head)
   - Q1: *“Select your flange size”* **or** *“How many bolts does your flange need?”* (user can use either as a first filter)
   - Q2: *“Select your bolt size”* (from `Size of bolts` among candidates)
   - Filters cascade until one row remains. On unique match, system **finalizes** and stores: `Ring needed`, `Truck Unit PSI`, `Wrench`, `# of bolts`, `Flange size`, `Size of bolts`.

4. **Branch C — Adapter Spool**
   - Q0: *“Are you using any Adapter Spools?”* If **Yes**, collect two sides independently:
   - **Side 1**:
     - Q1: *“Select your flange size”* **or** *“How many bolts does your flange need?”*
     - Q2: *“Select your bolt size.”*
     - Narrow to one row → store Side 1 specs (same finalized fields).
   - **Side 2**: repeat process to store Side 2 specs.
   - Completed Adapter Spool contains **both sides’** finalized spec objects.

5. **Stack Ordering & Report**
   - Ask: *“Do you want to generate your B.O.P stack report?”* If **Yes** → present a **drag‑and‑drop** list of the chosen parts (each Adapter Spool shows two collapsible sides).
   - User orders from top to bottom, then confirms.
   - System generates report lines:
     - `Part Name – Pressure {X if applicable} | Ring: {ring} | Size of Bolts: {size} | # Bolts: {n} | Flange: {flange} | Wrench Required: {wrench} | Set Truck PSI to: {psi}`
   - Provide **Download PDF** and **Clear & Start New**.

---

## 5) Information Architecture & Data Model
Normalize the uploaded dataset into Postgres.

### 5.1 Parsing & Normalization
- Parse `Flange size` into:
  - `nominal_bore` (TEXT, e.g., `13-5/8`)
  - `pressure_class_label` (TEXT, e.g., `10M`)
  - `pressure_class_psi` (INT, e.g., `10000`)
- Keep `ring_needed` as TEXT (e.g., `R-37 or RX-37`).
- `size_of_bolts` remains TEXT; `wrench_no` (INT), `truck_unit_psi` (INT), `bolt_count` (INT).
- Keep raw `flange_size_raw` as imported for traceability.

### 5.2 Tables (SQL‑level)
**`flange_spec`**
- `id` UUID (PK)
- `nominal_bore` TEXT NOT NULL
- `pressure_class_label` TEXT NOT NULL  — e.g., `3M`, `5M`, `10M`
- `pressure_class_psi` INT NOT NULL     — e.g., `3000`, `5000`, `10000`
- `bolt_count` INT NOT NULL
- `size_of_bolts` TEXT NOT NULL         — keep the original format (e.g., `1-1/8 × 7-1/4`)
- `wrench_no` INT NOT NULL
- `truck_unit_psi` INT NOT NULL
- `ring_needed` TEXT NOT NULL
- `flange_size_raw` TEXT NOT NULL       — original joined label, e.g., `4-1/16 3M`
- **Unique index** on (`nominal_bore`,`pressure_class_label`,`bolt_count`,`size_of_bolts`)

**`part_selection`** (a single chosen part instance in a stack; Adapter Spool uses two child rows)
- `id` UUID (PK)
- `stack_id` UUID (FK → `stack_header.id`)
- `part_type` TEXT CHECK in (`ANNULAR`,`SINGLE_RAM`,`DOUBLE_RAMS`,`MUD_CROSS`,`ANACONDA_LINES`,`ROTATING_HEAD`,`ADAPTER_SPOOL_SIDE`) — store spools as two `ADAPTER_SPOOL_SIDE` rows grouped by a `spool_group_id`.
- `spool_group_id` UUID NULL — same UUID for the two sides of the same adapter spool.
- `pressure_value` INT NULL — used only for pressure‑driven parts.
- `flange_spec_id` UUID NOT NULL (FK → `flange_spec.id`)
- `created_at` TIMESTAMP

**`stack_header`**
- `id` UUID (PK)
- `title` TEXT DEFAULT `B.O.P Stack`
- `created_at` TIMESTAMP

**`stack_order`**
- `stack_id` UUID (FK)
- `part_selection_id` UUID (FK)
- `position` INT NOT NULL (0‑based index)
- **PK** (`stack_id`,`part_selection_id`)

**`report_export`**
- `id` UUID (PK)
- `stack_id` UUID (FK)
- `rendered_html` TEXT
- `pdf_path` TEXT (local file path in Replit)
- `created_at` TIMESTAMP

**Optional**: `part_pressure_option` config table for UI:
- `part_type` TEXT
- `pressure_value` INT

### 5.3 Reference/Config (seeded from data)
From the uploaded sheet:
- `ANNULAR` → pressure options: **5000, 10000**
- `SINGLE_RAM` → **5000, 10000**
- `DOUBLE_RAMS` → **5000, 10000**
- `MUD_CROSS` → **10000**
- `ANACONDA_LINES`, `ROTATING_HEAD` → **no pressure** (geometry‑driven)

---

## 6) Validation & Selection Rules
1. **Pressure‑driven parts** must pick a pressure that exists in the corresponding column. If selection yields multiple flange candidates, prompt a **Flange size** dropdown to narrow. If still >1 match remains, prompt for **# of bolts** (rare), then **Size of bolts** as final disambiguation.
2. **Geometry‑driven parts** begin with either **Flange size** or **# of bolts**, then **Size of bolts**; must end with a **unique** `flange_spec_id`.
3. **Adapter Spool** must have two **independent** unique sides before it can be added to the stack.
4. Every finalized part stores: `ring_needed`, `truck_unit_psi`, `wrench_no`, `bolt_count`, `flange_size_raw`, `size_of_bolts`. (Pressure value stored only when applicable.)
5. If no unique match is possible, show: *“No unique flange spec found. Please refine filters”* and highlight available attributes to select.
6. All dropdowns should be populated **dynamically** from the filtered candidate set.

---

## 7) UI/UX Spec
**Tech:** React 18 + TypeScript (Vite). No login. Minimal, mobile‑friendly.

**Screens/States**
1. **Home / Builder**
   - “Add a Part” button → opens chooser modal: Annular, Single B.O.P (RAM), Double B.O.P (RAMs), Mud Cross, Anaconda Lines, Rotating Head, Adapter Spool.
   - For non‑spool parts, show inline stepper (Pressure → optional Flange size → optional # bolts → Bolt size) with live preview of the **Finalized Spec** card.
   - For Adapter Spool, show **Side 1** stepper, then **Side 2** stepper, then a combined preview card.
   - “Add to Stack” appends a card to the **Stack List**.

2. **Stack List**
   - Cards for each selected part; Adapter Spool card contains two collapsible side summaries.
   - Drag‑and‑drop reordering (e.g., `@dnd-kit/core`).
   - Actions per card: **Edit**, **Remove**.
   - Button: **Generate Report**.

3. **Report View**
   - Shows ordered lines, one per part.
   - **Adapter Spool rendering is fixed to two lines** per spool with labels **“Adapter Spool {Letter} — Side 1”** and **“Adapter Spool {Letter} — Side 2.”** Letters increment (A, B, C…) for multiple spools.
   - Buttons: **Download PDF**, **Back to Builder**, **Clear & Start New**.

**Elements**
- Dropdowns with search for long lists.
- Chips/tags showing the active filters.
- Toasts for success/error states.

**Copy examples**
- *“Select your flange size”*, *“How many bolts does your flange need?”*, *“Select your bolt size.”*
- *“What is the pressure of your part?”* (Annular / Single RAM / Double RAMs / Mud Cross only).

---

## 8) Backend/API
**Tech:** Node.js + Express (TypeScript). Postgres via `pg` (or Prisma if desired). Replit local FS for PDF output.

**Endpoints**
- `POST /ingest` — CSV/XLSX upload. Validates headers, parses, normalizes, upserts `flange_spec`. Returns counts & warnings.
- `GET /options/parts` — list of part types.
- `GET /options/pressures?part=ANNULAR` — returns `[5000,10000]` etc from live data.
- `GET /options/flanges` — supports filters: `part`, `pressure`, `flangeSize`, `boltCount`, `boltSize`. Returns matching `flange_spec` rows.
- `POST /stack` — create a new stack header; returns `stack_id`.
- `POST /stack/:id/items` — add part selection(s) (including two rows for an Adapter Spool with shared `spool_group_id`).
- `PATCH /stack/:id/order` — reorder items.
- `GET /stack/:id` — full stack with resolved specs.
- `POST /stack/:id/report` — render HTML; persist as `report_export` row.
- `GET /reports/:reportId/pdf` — stream PDF.
- `DELETE /stack/:id` — remove, including items.

**Validation**
- Reject part selections that don’t resolve to **one** `flange_spec` row.
- Strict enum checks for `part_type`.
- Coerce `Flange size` into normalized components.

---

## 9) Report Format (exact line spec)
**Pressure field rules**
- **Shown** only for **pressure‑driven parts**: Annular, Single B.O.P (RAM), Double B.O.P (RAMs), Mud Cross.
- **Omitted entirely** for **geometry‑driven parts**: Anaconda Lines, Rotating Head, and both sides of Adapter Spool.

For each finalized part (template with conditional segment):
```
{Part Label}{ — Pressure {pressure_value} | if pressure‑driven}Ring: {ring_needed} | Size of Bolts: {size_of_bolts} | # Bolts: {bolt_count} | Flange: {flange_size_raw} | Wrench Required: {wrench_no} | Set Truck PSI to: {truck_unit_psi}
```

**Examples** (data‑driven):
- `Rotating Head – Ring: BX-160 | Size of Bolts: 1-7/8 × 17-1/2 | # Bolts: 20 | Flange: 13-5/8 10M | Wrench Required: 11 | Set Truck PSI to: 1900`
- `Annular – Pressure 5000 | Ring: BX-160 | Size of Bolts: 1-5/8 × 12-3/4 | # Bolts: 16 | Flange: 13-5/8 5M | Wrench Required: 9 | Set Truck PSI to: 1300`
- `Adapter Spool A — Side 1 – Ring: R-37 or RX-37 | Size of Bolts: 1-1/8 × 7-1/4 | # Bolts: 8 | Flange: 4-1/16 3M | Wrench Required: 7 | Set Truck PSI to: 850`
- `Adapter Spool A — Side 2 – Ring: BX-160 | Size of Bolts: 1-7/8 × 17-1/2 | # Bolts: 20 | Flange: 13-5/8 10M | Wrench Required: 11 | Set Truck PSI to: 1900`

**PDF generation**
- Server renders HTML (simple, print‑optimized CSS) and converts to PDF via `pdf-lib` or `puppeteer` (headless Chrome) depending on Replit constraints. Save to `/reports/{reportId}.pdf`.

---

## 10) CSV/XLSX Ingestion Contract
**Accepted formats:** `.csv` or `.xlsx` with a sheet named `Common Flanges`.

**Required headers (case‑sensitive):**
`Flange size, # of bolts, Size of bolts, Wrench, Truck Unit PSI, Ring needed, Annular Pressure, Single B.O.P (RAM), Double B.O.P (Double Rams), Mud Cross`

**Optional sheet:** `Size Scale` with `Wrench #, Stud diameter (inches), Truck Unit PSI setting` (for cross‑checks / future logic).

**Parser behavior**
- Trims whitespace, normalizes `×` vs `x`.
- Parses pressure class from `Flange size` (e.g., `10M → 10000`).
- Treats blank pressure cells as “not applicable”.
- Dedupes identical flange entries by the unique index.
- Rejects rows missing any required non‑pressure fields.

**Example row → normalized**
- Input: `13-5/8 10M, 20, 1-7/8 × 17-1/2, 11, 1900, BX-159, -, -, 10000, 10000`
- Output: `nominal_bore=13-5/8, pressure_class_label=10M, pressure_class_psi=10000, bolt_count=20, size_of_bolts='1-7/8 × 17-1/2', wrench_no=11, truck_unit_psi=1900, ring_needed='BX-159'`

---

## 11) Acceptance Criteria
1. **Pressure dropdowns** show only values present in data for the chosen part type.
2. **Filtering** always converges to exactly one `flange_spec` before enabling **Add to Stack**.
3. **Adapter Spool** cannot be added until both sides are finalized.
4. **Stack ordering** via drag‑and‑drop updates the API and persists on refresh.
5. **Generate Report** shows all parts in order with the specified line format.
6. **Download PDF** saves a file that matches the report view and opens correctly.
7. **Clear & Start New** empties the stack and any in‑progress selections.
8. **Re‑ingesting** a corrected CSV/XLSX updates options without code changes.
9. **Naming** in the UI and report uses **dataset header labels** (e.g., `Single B.O.P (RAM)`).
10. **Adapter Spool** lines are labeled **exactly** as `Adapter Spool {Letter} — Side 1` and `Adapter Spool {Letter} — Side 2`.
11. **Geometry‑driven parts** (Anaconda Lines, Rotating Head, Adapter Spool sides) **must not** include a Pressure field in the report; pressure‑driven parts **must** include it.

---

## 12) Edge Cases & Rules of Thumb
- If a part type has **no** pressure options in the data, skip the pressure step.
- If multiple flange candidates persist after all questions, show a compact table to select the exact row (never guess).
- If a pressure is chosen that leaves **zero** rows, show *“No matches for {pressure}. Check your data or pick a different pressure.”*
- Normalize small typographical variations (`×` vs `x`, `1-1/8` vs `1 1/8`).
- Ensure UI copy matches oilfield terminology used in the dataset.

---

## 13) Implementation Notes
- **Repo layout** (monorepo optional):
  - `/api` (Express TS; Postgres; file upload & PDF generation)
  - `/web` (React + Vite; dnd, stepper UI)
  - `/shared` (TypeScript types & validation with `zod`)
- **Libraries (suggested):**
  - Validation: `zod`
  - Drag‑and‑drop: `@dnd-kit/core`
  - CSV/XLSX: `papaparse` (CSV), `xlsx` (XLSX)
  - PDF: `pdf-lib` or `puppeteer`
  - DB: `pg` or `prisma`
- **Environment:** Replit with Postgres add‑on; local FS for PDF outputs.

---

## 14) Decisions & Open Items
**Decisions (locked):**
- **Adapter Spool lines:** Use **two lines** per spool with labels *Adapter Spool A — Side 1* and *Adapter Spool A — Side 2* (subsequent spools: B, C, …).
- **Naming:** Use **dataset header labels** (e.g., `Single B.O.P (RAM)` vs `Single B.O.P Ram`).
- **Future data growth screen:** **Not in MVP**.
- **Geometry‑driven parts pressure display:** **Omit the Pressure field entirely** for **Anaconda Lines**, **Rotating Head**, and **Adapter Spool** sides in the report (no `Pressure` label or separator). We may revisit post‑MVP.

**No open items remain for MVP.**

---

## 15) Example Test Cases
- **T1 Annular 5M:** Add → choose *Annular*, pressure **5000** → Narrow by *Flange size* to `13-5/8 5M` → Finalize shows `BX-160`, wrench `9`, truck `1300`, bolts `16`, bolts size `1-5/8 × 12-3/4` → Add to stack.
- **T2 Rotating Head:** Add → choose *Rotating Head* → select *Flange size* `13-5/8 10M` → select *Size of bolts* `1-7/8 × 17-1/2` → Finalize → Add.
- **T3 Adapter Spool:** Side 1 & Side 2 finalized as above → Add (two sides stored). Reorder parts; generate report; download PDF; verify contents and labels (A — Side 1 / A — Side 2).

---

## 16) Future Enhancements (Post‑MVP)
- Save/load named stacks; version history.
- Shareable links; email PDF.
- Role‑based presets per rig.
- Inline warnings (e.g., mixing 5M and 10M inadvertently).
- International units support.
