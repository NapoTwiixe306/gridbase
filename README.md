# GridBase

[![CI](https://github.com/NapoTwiixe306/gridbase/actions/workflows/ci.yml/badge.svg)](https://github.com/NapoTwiixe306/gridbase/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/Data-CC%20BY%204.0-brightgreen.svg)](./LICENSE-DATA)

**GridBase** is an open-source REST API for motorsport data — drivers, teams, manufacturers, series, seasons, entries and transfers across endurance, single-seater and GT championships.

It is built for developers who want clean, structured, cross-series data: fantasy-league apps, statistics dashboards, Discord bots, journalists tracking the silly season, or anyone tired of scraping entry-list PDFs by hand.

The central idea of GridBase is the **Entry**: the link between a driver, a team, a season, a series and a car number. A driver is never "in a team" in the abstract — they hold one or more Entries, which is what makes multi-series and endurance line-ups (2–3 drivers per car) work naturally.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [API overview](#api-overview)
- [API reference](#api-reference)
- [Adding data — the complete guide](#adding-data--the-complete-guide)
  - [Cheat-sheet — which file do I edit?](#-cheat-sheet--which-file-do-i-edit)
  - [How to add a team](#how-to-add-a-team)
  - [How to add a driver](#how-to-add-a-driver)
  - [How to link a driver to a team — the Entry](#how-to-link-a-driver-to-a-team--the-entry-)
  - [How to record a transfer](#how-to-record-a-transfer)
  - [Full worked example](#full-worked-example--a-brand-new-driver-in-a-car)
  - [Importing F1 automatically](#importing-f1-automatically)
- [Contributing](#contributing)
- [License](#license)
- [Roadmap](#roadmap)

---

## Tech stack

- **Language:** TypeScript (strict mode, no `any`)
- **Runtime:** Node.js 20+
- **Framework:** Fastify v4
- **ORM:** Prisma
- **Database:** MySQL 8.0 (via Docker Compose)
- **Validation:** Zod on every route input
- **Tooling:** ESLint + Prettier

---

## Quick start

### Prerequisites

- Node.js 20 or newer
- Docker + Docker Compose
- npm

### 1. Install

```bash
git clone <your-fork-url> gridbase-api
cd gridbase-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` points at the Docker database on host port **3307** (3306 is avoided so it never clashes with a native MySQL install):

```
DATABASE_URL="mysql://gridbase:gridbase_dev@127.0.0.1:3307/gridbase"
PORT=3000
```

### 3. Start the database

```bash
docker-compose up -d
```

This starts MySQL 8.0 (host port `3307`) and Adminer (`http://localhost:8080`). An init script in `docker/mysql-init/` configures the `gridbase` user with the privileges Prisma needs (including shadow-database creation for migrations).

### 4. Migrate and seed

```bash
npm run db:migrate     # apply migrations
npm run db:seed        # load real 2025/2026 data
```

### 5. Run

```bash
npm run dev            # ts-node-dev with hot reload
```

Verify:

```bash
curl http://localhost:3000/health
# { "status": "ok", "timestamp": "...", "version": "0.1.0" }
```

### Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Seed the database |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` / `npm run format` | Lint / format the source |

---

## API overview

- **Base URL:** `http://localhost:3000`
- **Versioning:** all data routes live under `/api/v1`
- **Response format:** successful responses are JSON. Single resources and computed lists are wrapped as `{ "data": ... }`. Paginated collections return `{ "data": [...], "meta": {...} }`.
- **Pagination:** `?page` (default `1`) and `?limit` (default `20`, max `100`).
- **Rate limiting:** `100` requests per hour per IP by default (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`).

### Error format

Every error uses the same envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Driver not found",
    "statusCode": 404
  }
}
```

Codes: `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

---

## API reference

All endpoints are `GET` (the API is read-only for now). Base URL: `http://localhost:3000`.

### All endpoints (localhost)

| Endpoint | Description |
| --- | --- |
| `http://localhost:3000/health` | Health check |
| `http://localhost:3000/api/v1/stats` | Global totals (drivers, teams, circuits…) |
| `http://localhost:3000/api/v1/drivers` | List drivers — `?series=&nationality=&status=&page=&limit=` |
| `http://localhost:3000/api/v1/drivers/search?q=` | Search drivers (min 2 chars) |
| `http://localhost:3000/api/v1/drivers/:id` | Driver profile (+ `titles`, computed fields) |
| `http://localhost:3000/api/v1/drivers/:id/entries` | Driver entries — `?series=&season=` |
| `http://localhost:3000/api/v1/drivers/:id/titles` | Driver palmarès (championship titles) |
| `http://localhost:3000/api/v1/teams` | List teams — `?series=&country=&status=` |
| `http://localhost:3000/api/v1/teams/:id` | Team profile (+ current drivers) |
| `http://localhost:3000/api/v1/teams/:id/drivers` | Team current-season drivers |
| `http://localhost:3000/api/v1/teams/:id/transfers` | Team transfers — `?season=` |
| `http://localhost:3000/api/v1/series` | List series |
| `http://localhost:3000/api/v1/series/:slug` | Series detail (+ current season) |
| `http://localhost:3000/api/v1/seasons` | List seasons — `?series=&year=` |
| `http://localhost:3000/api/v1/seasons/:id` | Season detail |
| `http://localhost:3000/api/v1/categories` | List categories — `?series=` |
| `http://localhost:3000/api/v1/circuits` | List circuits (alphabetical) — `?country=&type=` |
| `http://localhost:3000/api/v1/circuits/:id` | Circuit detail (cuid or slug) |
| `http://localhost:3000/api/v1/manufacturers` | List manufacturers |
| `http://localhost:3000/api/v1/entries` | List entries — `?series=&season=&team=&driver=&category=` |
| `http://localhost:3000/api/v1/transfers` | List transfers — `?series=&season=&status=&team=&driver=` |
| `http://localhost:3000/api/v1/transfers/latest` | 20 most recent transfers |
| `http://localhost:3000/api/v1/search?q=` | Combined search (drivers, teams, series) |

> `:id` accepts a **cuid or a slug** (e.g. `max-verstappen`, `circuit-de-spa-francorchamps`); `:slug` is the series slug (e.g. `wec`).

### Health

#### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-06-28T20:13:30.469Z", "version": "0.1.0" }
```

### Drivers

#### `GET /api/v1/drivers`

Paginated list. Query params: `page`, `limit`, `series` (slug), `nationality` (ISO alpha-2), `status`.
Each driver includes a computed `current_entries` array (current-year entries).

#### `GET /api/v1/drivers/:id`

`:id` accepts a **cuid or a slug**. Returns the full profile with computed fields:

```json
{
  "data": {
    "firstName": "Daniel",
    "lastName": "Juncadella",
    "slug": "daniel-juncadella",
    "nationality": "ES",
    "current_entries": [
      {
        "carNumber": "19",
        "season": 2026,
        "team": { "fullName": "Genesis Magma Racing", "slug": "genesis-magma-racing" },
        "series": { "shortName": "WEC", "slug": "wec" },
        "category": { "fullName": "Hypercar", "abbreviation": "HYP" },
        "drivers": [ { "lastName": "Juncadella", "wecClassification": "PLATINUM" }, "..." ]
      }
    ],
    "current_teams": [ { "fullName": "Genesis Magma Racing" } ],
    "current_series": [ { "shortName": "WEC" } ],
    "is_multi_series": false,
    "primary_team": { "fullName": "Genesis Magma Racing" }
  }
}
```

#### `GET /api/v1/drivers/:id/entries`

All entries for a driver across all seasons and series. Optional filters: `?series=wec&season=2026`.

#### `GET /api/v1/drivers/:id/titles`

The driver's **championship titles** (palmarès), most recent first. The full driver profile (`GET /api/v1/drivers/:id`) also embeds `titles` and `titles_count`.

#### `GET /api/v1/drivers/search?q=`

Free-text search (min 2 chars) over `firstName`, `lastName` and `nickname`.

### Teams

#### `GET /api/v1/teams`

Paginated. Filters: `series`, `country`, `status`.

#### `GET /api/v1/teams/:id`

`:id` accepts cuid or slug. Returns the team plus `current_entries` and a deduplicated `current_drivers` list for the current season.

#### `GET /api/v1/teams/:id/drivers`

Current-season drivers for the team.

#### `GET /api/v1/teams/:id/transfers`

Transfers in/out of the team. Optional filter: `?season=2026`.

### Series & seasons

#### `GET /api/v1/series`

All series with data-coverage status and counts.

#### `GET /api/v1/series/:slug`

Series detail with categories and a `current_season` summary.

#### `GET /api/v1/seasons` · `GET /api/v1/seasons/:id`

List/detail of seasons. List filters: `series`, `year`.

### Categories

#### `GET /api/v1/categories`

Every class/category across all series (Hypercar, LMGT3, GTP, F1…), with its series and a count of entries. Optional `?series=<slug>` to restrict to one championship.

### Stats

#### `GET /api/v1/stats`

Global totals. `drivers` is the count of **unique** drivers across all series and categories combined (one row per person).

```json
{ "data": { "drivers": 34, "teams": 18, "series": 7, "categories": 13, "entries": 69, "transfers": 1 } }
```

### Circuits

#### `GET /api/v1/circuits`

All circuits, **alphabetical**, paginated. Filters: `country` (ISO alpha-2), `type` (`PERMANENT` / `STREET` / `OVAL` / `ROAD`).

#### `GET /api/v1/circuits/:id`

`:id` accepts a cuid or a slug, e.g. `circuit-de-spa-francorchamps`.

### Manufacturers

#### `GET /api/v1/manufacturers`

Paginated list of manufacturers.

### Entries

#### `GET /api/v1/entries`

Paginated. Filters: `series`, `season`, `team`, `driver`, `category` (abbreviation). `team` and `driver` accept cuid or slug.

```bash
curl "http://localhost:3000/api/v1/entries?driver=jules-gounon"
```

### Transfers

#### `GET /api/v1/transfers`

Paginated. Filters: `series`, `season`, `status`, `team`, `driver`.

#### `GET /api/v1/transfers/latest`

The 20 most recent transfers across all series.

### Search

#### `GET /api/v1/search?q=`

Combined search returning `{ "data": { "drivers": [], "teams": [], "series": [] } }`.

---

## Adding data — the complete guide

You never edit code to add a driver, a team or a race entry. **You edit a JSON file and run one command.** All data lives as plain JSON under `prisma/seed/data/`; the seed validates it and loads it into the database.

There are two ways data gets in:

| Method | What it covers | How |
| --- | --- | --- |
| ✍️ **By hand (JSON files)** | Anything: any series, team, driver, entry, transfer | Edit a file in `prisma/seed/data/`, then `npm run db:seed` |
| 🤖 **Automated (F1 only)** | All current F1 drivers, teams & entries (2024–2026) | `npm run ingest:single-seaters` |

> Endurance, GT and F2/F3 have no free bulk API yet, so they are added **by hand**. F1 can be imported **automatically** from Jolpica + OpenF1 — see [Importing F1 automatically](#importing-f1-automatically).

### 📌 Cheat-sheet — which file do I edit?

| I want to add / change… | 📁 File to create or edit | ▶️ Then run |
| --- | --- | --- |
| A **championship** (series) | `prisma/seed/data/series.json` | `npm run db:seed` |
| A **season** (one year of a series) | `prisma/seed/data/seasons.json` | `npm run db:seed` |
| A **class / category** | `prisma/seed/data/categories.json` | `npm run db:seed` |
| A **manufacturer** | `prisma/seed/data/manufacturers.json` | `npm run db:seed` |
| A **circuit** | `prisma/seed/data/circuits.json` | `npm run db:seed` |
| A **team** | `prisma/seed/data/teams/<any-name>.json` | `npm run db:seed` |
| A **driver** | `prisma/seed/data/drivers/<any-name>.json` | `npm run db:seed` |
| An **entry** (driver ↔ team for a season) | `prisma/seed/data/entries/<any-name>.json` | `npm run db:seed` |
| A **transfer** | `prisma/seed/data/transfers/<any-name>.json` | `npm run db:seed` |
| A **driver title** (palmarès) | `prisma/seed/data/titles/<any-name>.json` | `npm run db:seed` |
| **All F1 drivers & teams** | _auto-generated files_ | `npm run ingest:single-seaters` then `npm run db:seed` |

Every file is a **JSON array** of objects. You can name the files anything and nest folders freely (`teams/wec.json`, `drivers/f1/2026.json`) — every `.json` inside a folder is loaded.

```
prisma/seed/
├── data/
│   ├── series.json            ← championships          (single file)
│   ├── seasons.json           ← years of each series   (single file)
│   ├── categories.json        ← classes (Hypercar…)    (single file)
│   ├── manufacturers.json     ← car makers             (single file)
│   ├── teams/      *.json      ← teams                  (folder, any files)
│   ├── drivers/    *.json      ← drivers                (folder, any files)
│   ├── entries/    *.json      ← driver↔team↔season     (folder, any files)
│   └── transfers/  *.json      ← driver movements       (folder, any files)
├── seeders/                    one bulk loader per entity
├── validation.ts              one validation rule-set per record
└── index.ts                   loads everything in the right order
```

### 3 rules to remember

1. **You reference things by their natural key, never by a database ID.** A team → its `slug`, a series → its `slug`, a season → its `year`, a category → its `abbreviation`, a manufacturer → its `name`, a driver → its `slug`.
2. **Slugs are generated for you** from the name: lowercase, accents removed, spaces → hyphens. `"Genesis Magma Racing"` → `genesis-magma-racing`, `"Jules Gounon"` → `jules-gounon`. That generated slug is exactly what you type elsewhere to point at the record.
3. **An `ACTIVE` driver must have at least one entry.** Add the driver and an entry in the same `db:seed`. A driver with no seat should be `"status": "WITHOUT_SEAT"`. The seed refuses to finish otherwise.

If anything is wrong, the seed stops and points at the exact spot:
`Invalid record in "drivers/wec.json" [#3]: nationality: Must be a valid ISO 3166-1 alpha-2 country code`.

---

## How to add a team

> 📁 **File:** `prisma/seed/data/teams/<your-file>.json` &nbsp;·&nbsp; ▶️ **Run:** `npm run db:seed`

A team is the organisation that fields cars. Add one object to the array.

**Required fields**

| Field | Type / rule | Example |
| --- | --- | --- |
| `fullName` | text — the official name | `"Alpine Endurance Team"` |
| `shortName` | text — display short name | `"Alpine"` |
| `country` | ISO 3166-1 **alpha-2** | `"FR"` |

**Optional fields:** `primaryColor` & `secondaryColor` (hex `#RRGGBB` — **leave empty `""` or omit if you don't have the colours yet**), `city`, `foundedYear`, `dissolvedYear`, `officialWebsite`, `instagram`, `twitter`, `status` (`ACTIVE` *default* / `INACTIVE` / `MERGED` / `ACQUIRED`), `nameHistory` (`[{ "name": "Lotus F1", "year": 2012 }]`).

```json
[
  {
    "fullName": "Alpine Endurance Team",
    "shortName": "Alpine",
    "country": "FR",
    "city": "Viry-Châtillon",
    "primaryColor": "#0055A4",
    "secondaryColor": "#ED1C24",
    "foundedYear": 2023,
    "officialWebsite": "https://www.alpine-cars.com"
  }
]
```

➡️ This team's generated slug is **`alpine-endurance-team`**. That is the value you'll put in `"team"` when creating an entry.

**Common mistakes:** if you provide a colour it must be 6 hex digits with a leading `#` (`"#0055A4"`, not `"0055A4"` or `"blue"`) — but you can leave it empty/omit it · `country` is the 2-letter code, not the full country name.

---

## How to add a driver

> 📁 **File:** `prisma/seed/data/drivers/<your-file>.json` &nbsp;·&nbsp; ▶️ **Run:** `npm run db:seed`

**Required fields**

| Field | Type / rule | Example |
| --- | --- | --- |
| `firstName` | text | `"Jules"` |
| `lastName` | text | `"Gounon"` |
| `nationality` | ISO 3166-1 **alpha-2** | `"AD"` |

**Optional fields:** `dateOfBirth` (`"YYYY-MM-DD"`), `cityOfBirth`, `countryOfBirth` (alpha-2), `racingNumber` (number), `nickname`, `shortBio`, `officialWebsite`, `instagram`, `twitter`, `status` (`ACTIVE` *default* / `RETIRED` / `DECEASED` / `WITHOUT_SEAT`), and the photo block.

**Photo rules (strict):**
- `photoUrl` **must** start with `https://upload.wikimedia.org` or `https://commons.wikimedia.org` — Wikimedia Commons only.
- `photoLicense` is `CC0`, `CC_BY` or `CC_BY_SA`.
- `photographerCredit` is **required** when `photoLicense` is `CC_BY_SA`.
- `photoSourceUrl` should link the Wikimedia source page.

```json
[
  {
    "firstName": "Jules",
    "lastName": "Gounon",
    "nationality": "AD",
    "dateOfBirth": "1995-01-23",
    "countryOfBirth": "FR",
    "status": "ACTIVE"
  }
]
```

➡️ This driver's generated slug is **`jules-gounon`** — the value you'll put in `"driver"` inside an entry.

**Remember rule #3:** an `ACTIVE` driver needs an entry. Add the entry below in the same `db:seed`, or the seed will stop with a clear integrity error.

---

## How to link a driver to a team — the Entry ⭐

> 📁 **File:** `prisma/seed/data/entries/<your-file>.json` &nbsp;·&nbsp; ▶️ **Run:** `npm run db:seed`

The **Entry** is the heart of GridBase: it represents **one car** — a team, in a season, in a series, with a car number — and the driver(s) assigned to it. This is what links a driver to a team. Because the link lives on the Entry:
- the **same driver** can have **several entries** (different series, or different years), and
- a **single car** can carry **2–3 drivers** (endurance).

**Before an entry can be created, these must exist** (adding them in the same `db:seed` is fine — order across files doesn't matter):

| Referenced by the entry via… | …must already be defined in |
| --- | --- |
| `"team"` (slug) | `teams/…json` |
| `"driver"` (slug) | `drivers/…json` |
| `"series"` (slug) | `series.json` |
| `"season"` (year) | `seasons.json` |
| `"category"` (abbreviation, optional) | `categories.json` |
| `"manufacturer"` (name, optional) | `manufacturers.json` |

**Entry fields**

| Field | Required | Notes |
| --- | --- | --- |
| `team` | ✅ | team **slug** |
| `series` | ✅ | series **slug** |
| `season` | ✅ | year as a **number**, e.g. `2026` |
| `carNumber` | ✅ | text, e.g. `"19"` (unique per season) |
| `drivers` | ✅ | array — at least one (see below) |
| `category` | — | class **abbreviation**, e.g. `"HYP"` |
| `manufacturer` | — | manufacturer **name**, e.g. `"Genesis"` |
| `chassis` | — | e.g. `"Alpine A424"` |
| `status` | — | `CONFIRMED` *default* / `RUMOUR` / `CANCELLED` / `WITHDRAWN` |
| `announcedAt`, `sourceUrl` | — | metadata |

**Each item in `drivers`:** `driver` (✅ slug), `role` (`TITULAR` *default* / `REPLACEMENT` / `ENDURANCE_ONLY` / `GUEST`), `isPrimary` (boolean — the lead/headline driver), `wecClassification` (`PLATINUM` / `GOLD` / `SILVER` / `BRONZE`).

### Single-seater (F1, F2, F3) — one driver

```json
[
  {
    "team": "alpine",
    "series": "f1",
    "season": 2026,
    "category": "F1",
    "carNumber": "10",
    "drivers": [{ "driver": "pierre-gasly", "role": "TITULAR", "isPrimary": true }]
  }
]
```

> For F1 you normally don't write this by hand — `npm run ingest:single-seaters` creates every F1 entry for you.

### Endurance (WEC, IMSA) — two or three drivers

WEC Hypercar and LMGT3 cars are shared by a crew. **WEC classification** (Platinum / Gold / Silver / Bronze) grades each driver: LMGT3 line-ups must balance the ratings, while Hypercar crews are typically all Platinum.

```json
[
  {
    "team": "genesis-magma-racing",
    "series": "wec",
    "season": 2026,
    "category": "HYP",
    "carNumber": "19",
    "chassis": "Genesis GMR-001",
    "manufacturer": "Genesis",
    "drivers": [
      { "driver": "daniel-juncadella", "isPrimary": true, "wecClassification": "PLATINUM" },
      { "driver": "mathieu-jaminet", "wecClassification": "PLATINUM" },
      { "driver": "paul-loup-chatin", "wecClassification": "PLATINUM" }
    ]
  }
]
```

### Multi-series — the same driver, a second entry

A driver racing in two programmes just gets a **second entry**. Nothing changes on the driver record; `is_multi_series` flips to `true` automatically. Just add another object (it can live in the same file):

```json
[
  {
    "team": "genesis-magma-racing",
    "series": "wec",
    "season": 2026,
    "category": "LMGT3",
    "carNumber": "88",
    "drivers": [{ "driver": "daniel-juncadella", "role": "ENDURANCE_ONLY", "wecClassification": "GOLD" }]
  }
]
```

---

## How to record a transfer

> 📁 **File:** `prisma/seed/data/transfers/<your-file>.json` &nbsp;·&nbsp; ▶️ **Run:** `npm run db:seed`

A **Transfer** records a *change* — a driver moving teams or series, retiring, or returning. It is **not** the same as an Entry:
- an **Entry** = a fact about a season ("who is in which car"),
- a **Transfer** = a news event about movement ("driver X joins team Y for 2026").

**Required:** `driver` (slug). **Optional:** `fromTeam` / `toTeam` (team slugs), `fromSeries` / `toSeries` (series slugs), `season` (text, `"2026"`), `announcedAt`, `effectiveAt`, `status` (`RUMOUR` *default* → `CONFIRMED` → `OFFICIAL`, or `CANCELLED`), `type` (`TRANSFER` *default* / `RETIREMENT` / `COMEBACK` / `REPLACEMENT` / `LOAN`), `sourceUrl`, `notes`.

```json
[
  {
    "driver": "daniel-juncadella",
    "toTeam": "genesis-magma-racing",
    "toSeries": "wec",
    "season": "2026",
    "status": "OFFICIAL",
    "type": "TRANSFER",
    "sourceUrl": "https://motorsport.hyundai.com/..."
  }
]
```

---

## Full worked example — a brand-new driver in a car

Goal: add **Théo Pourchaire** to **ART Grand Prix** in F2 2026.
The `f2` series, its `F2` category and its 2026 season are already declared in the reference files, so we just add a team, a driver, and the entry that ties them together. Three files, one command.

**1.** Add the team — `prisma/seed/data/teams/f2.json`:
```json
[{ "fullName": "ART Grand Prix", "shortName": "ART", "country": "FR", "primaryColor": "#000000" }]
```

**2.** Add the driver — `prisma/seed/data/drivers/f2.json`:
```json
[{ "firstName": "Théo", "lastName": "Pourchaire", "nationality": "FR", "status": "ACTIVE" }]
```

**3.** Link them with an entry — `prisma/seed/data/entries/f2-2026.json`:
```json
[
  {
    "team": "art-grand-prix",
    "series": "f2",
    "season": 2026,
    "category": "F2",
    "carNumber": "1",
    "drivers": [{ "driver": "theo-pourchaire", "isPrimary": true }]
  }
]
```

**4.** Run it:
```bash
npm run db:seed
```

Check the result: `GET /api/v1/drivers/theo-pourchaire` shows ART Grand Prix in `current_entries`, and `GET /api/v1/teams/art-grand-prix` lists the driver. ✅

---

## Importing F1 automatically

Instead of writing F1 by hand, **generate the JSON files** from public APIs:

```bash
npm run ingest:single-seaters   # 1. writes the F1 files into prisma/seed/data/
npm run db:seed                 # 2. loads everything (incl. F1) into the database
```

The ingest does **not** touch the database — it only **writes JSON files**, exactly like the hand-authored ones, so there is a single source of truth (the files, versioned in git):

```
prisma/seed/data/drivers/f1.json
prisma/seed/data/teams/f1.json
prisma/seed/data/entries/f1-2024.json · f1-2025.json · f1-2026.json
```

It pulls drivers, teams and entries for 2024–2026 from the free **Jolpica** API (the Ergast successor) and uses **OpenF1** for accurate per-season car numbers. The output is deterministic (sorted) for clean git diffs, so you can re-run it to refresh the data and review the changes. You may also hand-edit the generated files afterwards. F2/F3 are not generated (no free entry-list API) — add them by hand. Details are documented at the top of `scripts/ingest-single-seaters.ts`.

---

## Contributing

Contributions are welcome — data corrections, new series, and code. Please keep data sourced and verifiable: every Entry and Transfer should carry a `sourceUrl` where possible, and driver photos must come from Wikimedia Commons with a correct licence. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full philosophy (accuracy over volume, sources over guesses) and a step-by-step guide to adding data.

## License

- **Code:** GNU Affero General Public License v3.0 (AGPL-3.0) — see [`LICENSE`](./LICENSE)
- **Data:** Creative Commons Attribution 4.0 (CC BY 4.0) — see [`LICENSE-DATA`](./LICENSE-DATA)

## Roadmap

- Write API (`POST`/`PATCH`) with authentication
- Results and standings per season
- Circuits and calendar/events
- Automated ingestion from Jolpica (F1) and OpenF1
- OpenAPI / Swagger documentation
- Public hosted instance
