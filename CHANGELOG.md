# Changelog

All notable changes to GridBase are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned
- Driver palmarès beyond championship titles (major race wins).
- Public hosted instance.

## [0.1.1] - 2026-06-30

Big data + features release: every category is now populated, plus circuits,
calendars and palmarès.

### Added
- **GTWC Europe**, **F2**, **F3** and **DTM** 2026 grids — all 14 categories now
  have entries.
- **Circuits** entity (`/circuits`) — 180 real circuits worldwide.
- **Calendars**: `Round` model linking each season to its circuits, with
  `GET /series/:slug/calendar` and `GET /series/:slug/circuits`.
- **Driver palmarès**: `DriverTitle` model + `GET /drivers/:id/titles`
  (championship titles); embedded in the driver profile.
- **Strict CI** (GitHub Actions): Prettier, ESLint (0 warnings), TypeScript,
  a DB-free **data validator** (`npm run validate:data`) and a real MySQL
  migrate + seed job.
- `LICENSE`, `LICENSE-DATA`, `CHANGELOG.md`; full localhost endpoint reference
  with a live example per route.

### Data coverage (2026)
| Series | Entries | | Series | Entries |
| --- | --- | --- | --- | --- |
| F1 | 67 | | IMSA (GTP/LMP2/GTD Pro/GTD) | 46 |
| WEC (Hypercar/LMGT3) | 35 | | GTWC Europe (Pro/Gold/Silver/Bronze) | 56 |
| F2 | 22 | | DTM | 21 |
| F3 | 30 | | | |

**Totals:** 426 drivers · 125 teams · 277 entries · 180 circuits · 84 rounds ·
46 titles · 7 series · 14 categories.

## [0.1.0] - 2026-06-29

First public release.

### Added
- REST API (Fastify + Prisma + MySQL) with endpoints for `drivers`, `teams`,
  `manufacturers`, `series`, `seasons`, `categories`, `entries`, `transfers`,
  `search`, `stats` and `health`.
- File-based, Zod-validated seed (`prisma/seed/data/`) with bulk loading and a
  natural-key reference system (slugs / names / years).
- F1 ingestion from the free Jolpica + OpenF1 APIs
  (`scripts/ingest-single-seaters.ts`), generating versioned JSON files.
- Bilingual documentation (`README.md` / `README.fr.md`) and `CONTRIBUTING.md`.
- Licensing: AGPL-3.0 for code (`LICENSE`), CC BY 4.0 for data (`LICENSE-DATA`).

### Data coverage (2026 season unless noted)
| Series | Classes | Entries | Drivers |
| --- | --- | --- | --- |
| **F1** | Formula One (2024–2026) | 67 | 28 |
| **WEC** | Hypercar (17), LMGT3 (18) | 35 | 105 |
| **IMSA** | GTP (9), LMP2 (10), GTD Pro (12), GTD (15) | 46 | 126 |

**Totals:** 148 entries · 236 unique drivers · 68 teams · 18 manufacturers ·
7 series · 13 categories · 1 transfer.

### Not yet covered
- GTWC Europe, DTM, F2 and F3 — series, seasons and categories exist, but
  entries are pending. Contributions welcome (see `CONTRIBUTING.md`).

[Unreleased]: https://github.com/NapoTwiixe306/gridbase/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/NapoTwiixe306/gridbase/releases/tag/v0.1.1
[0.1.0]: https://github.com/NapoTwiixe306/gridbase/releases/tag/v0.1.0
