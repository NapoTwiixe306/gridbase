# Changelog

All notable changes to GridBase are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned
- Data coverage for GTWC Europe (Pro / Pro-Am / Am), DTM, F2 and F3.
- Optional CI (lint + type-check + build) on pull requests.

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

[Unreleased]: https://github.com/NapoTwiixe306/gridbase/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/NapoTwiixe306/gridbase/releases/tag/v0.1.0
