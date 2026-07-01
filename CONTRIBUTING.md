# Contributing to GridBase API

Thanks for helping build GridBase API — an open, structured database of motorsport
entries. Most contributions are **data** (drivers, teams, race entries) and they
are easy to make: you edit a JSON file and run one command. Code contributions
are welcome too.

> 🇫🇷 Un guide détaillé en français est dans [`README.fr.md`](./README.fr.md)
> (section « Ajouter des données »). The English version lives in
> [`README.md`](./README.md).

---

## The one rule that matters most

**Only real, verifiable data.** Never invent a driver, a car number, a lineup or
a date. If you can't source it, don't add it. Whenever possible, include a
`sourceUrl` (official entry list, team announcement, series website). Accuracy
beats volume — a small, correct dataset is worth more than a large, wrong one.

---

## How the data is organised

All data lives as plain JSON under `prisma/seed/data/`, one folder per
high-volume entity. The seed validates every record and loads it into the
database. You never edit code to add data.

```
prisma/seed/data/
├── series.json          championships          (single file)
├── seasons.json         years of each series   (single file)
├── categories.json      classes (Hypercar…)    (single file)
├── manufacturers.json   car makers             (single file)
├── teams/      *.json    teams                 (folder, any file names)
├── drivers/    *.json    drivers               (folder)
├── entries/    *.json    driver ↔ team ↔ season (folder)
└── transfers/  *.json    driver movements      (folder)
```

Folders are loaded **recursively**, so split files however you like
(`drivers/wec.json`, `entries/imsa-2026.json`, …).

### Golden rules

1. **Reference things by their natural key, never a database ID** — a team by
   its `slug`, a series by its `slug`, a season by its `year`, a category by its
   `abbreviation`, a manufacturer by its `name`, a driver by its `slug`.
2. **Slugs are generated for you** from the name (lowercase, accents removed,
   spaces → hyphens): `"Jules Gounon"` → `jules-gounon`. That generated slug is
   what you type elsewhere to reference the record.
3. **An `ACTIVE` driver must have at least one entry.** Add the driver and an
   entry in the same change. A driver with no seat should be `WITHOUT_SEAT`.
4. **An "empty" file must contain `[]`** (an empty JSON array), not zero bytes —
   a truly empty file breaks the seed.
5. **Numbers are numbers, text is text.** `"foundedYear": 2007` (no quotes),
   `"country": "US"` (quotes). Use ISO 3166-1 **alpha-2** country codes.

If a record is invalid, the seed stops with the exact file, index and field:
`Invalid record in "drivers/wec.json" [#3]: nationality: Must be a valid ISO 3166-1 alpha-2 country code`.

---

## Cheat-sheet — which file do I edit?

| I want to add… | File | Then run |
| --- | --- | --- |
| A championship (series) | `prisma/seed/data/series.json` | `npm run db:seed` |
| A season | `prisma/seed/data/seasons.json` | `npm run db:seed` |
| A class / category | `prisma/seed/data/categories.json` | `npm run db:seed` |
| A manufacturer | `prisma/seed/data/manufacturers.json` | `npm run db:seed` |
| A team | `prisma/seed/data/teams/<name>.json` | `npm run db:seed` |
| A driver | `prisma/seed/data/drivers/<name>.json` | `npm run db:seed` |
| An entry (driver ↔ team ↔ season) | `prisma/seed/data/entries/<name>.json` | `npm run db:seed` |
| A transfer | `prisma/seed/data/transfers/<name>.json` | `npm run db:seed` |

Full field references and examples are in the **README** ("Adding data — the
complete guide"). A minimal entry, for reference:

```json
{
  "team": "genesis-magma-racing",
  "series": "wec",
  "season": 2026,
  "category": "HYP",
  "carNumber": "19",
  "manufacturer": "Genesis",
  "drivers": [{ "driver": "daniel-juncadella", "isPrimary": true, "wecClassification": "PLATINUM" }]
}
```

### File conventions

- **Entries** are season-bound → name them per season: `imsa-2026.json`.
- **Drivers / teams** persist across seasons → name them per series:
  `imsa.json` (no year). One fiche per person/team, even across series.

---

## Testing your contribution locally

```bash
docker-compose up -d        # start MySQL (host port 3307)
npm install
npm run db:seed             # load the data — fails loudly if anything is invalid
npm run dev                 # start the API on http://localhost:3000
```

Then check it appears, e.g. `GET /api/v1/teams?series=imsa` or
`GET /api/v1/drivers/<slug>`. The seed also refuses to finish if an `ACTIVE`
driver has no entry, so a green seed is a good first signal.

> F1 is the exception: it is generated from public APIs with
> `npm run ingest:single-seaters` (writes the F1 JSON files), then `db:seed`.

---

## Code contributions

- **Stack:** TypeScript (strict, **no `any`**), Fastify, Prisma, Zod.
- Validate every route input with Zod; keep the consistent error envelope.
- Before opening a PR:

  ```bash
  npm run lint        # eslint, must pass
  npx tsc --noEmit    # type-check, must pass
  npm run format      # prettier
  ```

- Schema changes go through Prisma migrations (`prisma/migrations/`), committed
  with the change.

---

## Pull requests

- Keep PRs focused (one series/class or one feature at a time).
- For data PRs, mention your **source** in the description (and `sourceUrl` in
  the records where it fits).
- Make sure `npm run db:seed`, `npm run lint` and `npx tsc --noEmit` all pass.
- Be kind and constructive. By contributing you agree your **code** is licensed
  under AGPL-3.0 and your **data** under CC BY 4.0 (see `LICENSE` and
  `LICENSE-DATA`).

Thanks for making motorsport data open. 🏁
