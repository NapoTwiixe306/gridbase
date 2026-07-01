# GridBase API

[![CI](https://github.com/NapoTwiixe306/gridbase-api/actions/workflows/ci.yml/badge.svg)](https://github.com/NapoTwiixe306/gridbase-api/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/Data-CC%20BY%204.0-brightgreen.svg)](./LICENSE-DATA)

**GridBase API** est une API REST open source dédiée aux données du sport automobile : pilotes, écuries, constructeurs, championnats, saisons, engagements et transferts, à travers l'endurance, la monoplace et le GT.

Elle s'adresse aux développeurs qui veulent des données propres, structurées et inter-championnats : applications de jeux de pronostics, tableaux de bord statistiques, bots Discord, journalistes qui suivent le mercato, ou tous ceux qui en ont assez de gratter des listes d'engagés au format PDF.

L'idée centrale de GridBase API, c'est l'**engagement** (*Entry*) : le lien entre un pilote, une écurie, une saison, un championnat et un numéro de voiture. Un pilote n'appartient jamais à une écurie « dans l'absolu » — il détient un ou plusieurs engagements. C'est ce qui rend naturels le multi-championnat et les équipages d'endurance (2 à 3 pilotes par voiture).

---

## Sommaire

- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide)
- [Vue d'ensemble de l'API](#vue-densemble-de-lapi)
- [Référence de l'API](#référence-de-lapi)
- [Ajouter des données — le guide complet](#ajouter-des-données--le-guide-complet)
  - [Aide-mémoire — quel fichier éditer ?](#-aide-mémoire--quel-fichier-éditer-)
  - [Comment ajouter une écurie](#comment-ajouter-une-écurie)
  - [Comment ajouter un pilote](#comment-ajouter-un-pilote)
  - [Comment relier un pilote à une écurie — l'engagement](#comment-relier-un-pilote-à-une-écurie--lengagement-)
  - [Comment enregistrer un transfert](#comment-enregistrer-un-transfert)
  - [Exemple complet](#exemple-complet--un-nouveau-pilote-dans-une-voiture)
  - [Importer la F1 automatiquement](#importer-la-f1-automatiquement)
- [Contribuer](#contribuer)
- [Licence](#licence)
- [Feuille de route](#feuille-de-route)

---

## Stack technique

- **Langage :** TypeScript (mode strict, aucun `any`)
- **Runtime :** Node.js 20+
- **Framework :** Fastify v4
- **ORM :** Prisma
- **Base de données :** MySQL 8.0 (via Docker Compose)
- **Validation :** Zod sur chaque entrée de route
- **Outils :** ESLint + Prettier

---

## Démarrage rapide

### Prérequis

- Node.js 20 ou plus récent
- Docker + Docker Compose
- npm

### 1. Installation

```bash
git clone <url-de-votre-fork> gridbase-api
cd gridbase-api
npm install
```

### 2. Configuration de l'environnement

```bash
cp .env.example .env
```

Le `.env` par défaut pointe vers la base Docker sur le port hôte **3307** (on évite 3306 pour ne jamais entrer en conflit avec un MySQL installé nativement) :

```
DATABASE_URL="mysql://gridbase-api:gridbase_dev@127.0.0.1:3307/gridbase-api"
PORT=3000
```

### 3. Lancer la base de données

```bash
docker-compose up -d
```

Cette commande démarre MySQL 8.0 (port hôte `3307`) et Adminer (`http://localhost:8080`). Un script d'init dans `docker/mysql-init/` configure l'utilisateur `gridbase-api` avec les privilèges nécessaires à Prisma (y compris la création de la *shadow database* pour les migrations).

### 4. Migrer et alimenter

```bash
npm run db:migrate     # applique les migrations
npm run db:seed        # charge des données réelles 2025/2026
```

### 5. Démarrer

```bash
npm run dev            # ts-node-dev avec rechargement à chaud
```

Vérification :

```bash
curl http://localhost:3000/health
# { "status": "ok", "timestamp": "...", "version": "0.1.0" }
```

### Scripts utiles

| Script | Description |
| --- | --- |
| `npm run dev` | Serveur de dev avec rechargement à chaud |
| `npm run build` | Compile le TypeScript vers `dist/` |
| `npm start` | Lance le serveur compilé |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Alimente la base |
| `npm run db:reset` | Réinitialise, re-migre et ré-alimente |
| `npm run db:studio` | Ouvre Prisma Studio |
| `npm run lint` / `npm run format` | Lint / formatage du code |

---

## Vue d'ensemble de l'API

- **URL de base :** `http://localhost:3000`
- **Versionnage :** toutes les routes de données sont sous `/api/v1`
- **Format des réponses :** JSON. Les ressources uniques et les listes calculées sont encapsulées dans `{ "data": ... }`. Les collections paginées renvoient `{ "data": [...], "meta": {...} }`.
- **Pagination :** `?page` (défaut `1`) et `?limit` (défaut `20`, max `100`).
- **Limitation de débit :** `100` requêtes par heure et par IP par défaut (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`).

### Format d'erreur

Toutes les erreurs partagent la même enveloppe :

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Driver not found",
    "statusCode": 404
  }
}
```

Codes : `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

---

## Référence de l'API

Toutes les routes sont en `GET` (l'API est en lecture seule pour l'instant). URL de base : `http://localhost:3000`.

### Toutes les routes (localhost)

| Route | Exemple live (copier-coller) | Description |
| --- | --- | --- |
| `/health` | `http://localhost:3000/health` | Vérification de santé |
| `/api/v1/stats` | `http://localhost:3000/api/v1/stats` | Totaux globaux |
| `/api/v1/drivers` | `http://localhost:3000/api/v1/drivers?series=f1` | Liste pilotes — `?series=&nationality=&status=&page=&limit=` |
| `/api/v1/drivers/search` | `http://localhost:3000/api/v1/drivers/search?q=verstappen` | Recherche pilotes (2 car. min) |
| `/api/v1/drivers/:id` | `http://localhost:3000/api/v1/drivers/max-verstappen` | Profil pilote (+ `titles`) |
| `/api/v1/drivers/:id/entries` | `http://localhost:3000/api/v1/drivers/jules-gounon/entries` | Engagements du pilote — `?series=&season=` |
| `/api/v1/drivers/:id/titles` | `http://localhost:3000/api/v1/drivers/lewis-hamilton/titles` | Palmarès du pilote |
| `/api/v1/teams` | `http://localhost:3000/api/v1/teams?series=wec` | Liste écuries — `?series=&country=&status=` |
| `/api/v1/teams/:id` | `http://localhost:3000/api/v1/teams/scuderia-ferrari` | Profil écurie |
| `/api/v1/teams/:id/drivers` | `http://localhost:3000/api/v1/teams/alpine-endurance-team/drivers` | Pilotes de l'écurie |
| `/api/v1/teams/:id/transfers` | `http://localhost:3000/api/v1/teams/genesis-magma-racing/transfers` | Transferts de l'écurie — `?season=` |
| `/api/v1/series` | `http://localhost:3000/api/v1/series` | Liste championnats |
| `/api/v1/series/:slug` | `http://localhost:3000/api/v1/series/wec` | Détail championnat |
| `/api/v1/series/:slug/calendar` | `http://localhost:3000/api/v1/series/f1/calendar?season=2026` | Calendrier (manches + circuit) |
| `/api/v1/series/:slug/circuits` | `http://localhost:3000/api/v1/series/imsa/circuits?season=2026` | Circuits d'un championnat |
| `/api/v1/calendar/upcoming` | `http://localhost:3000/api/v1/calendar/upcoming?limit=10` | **Prochaines courses** toutes séries (datées) — `?series=&limit=` |
| `/api/v1/seasons` | `http://localhost:3000/api/v1/seasons?series=f1` | Liste saisons — `?series=&year=` |
| `/api/v1/seasons/:id` | `http://localhost:3000/api/v1/seasons/<cuid>` | Détail saison |
| `/api/v1/categories` | `http://localhost:3000/api/v1/categories?series=imsa` | Liste catégories — `?series=` |
| `/api/v1/circuits` | `http://localhost:3000/api/v1/circuits?country=GB` | Liste circuits — `?country=&type=` |
| `/api/v1/circuits/:id` | `http://localhost:3000/api/v1/circuits/circuit-de-spa-francorchamps` | Détail circuit |
| `/api/v1/manufacturers` | `http://localhost:3000/api/v1/manufacturers` | Liste constructeurs |
| `/api/v1/entries` | `http://localhost:3000/api/v1/entries?series=wec&season=2026` | Liste engagements — `?series=&season=&team=&driver=&category=` |
| `/api/v1/transfers` | `http://localhost:3000/api/v1/transfers?status=OFFICIAL` | Liste transferts — `?series=&season=&status=&team=&driver=` |
| `/api/v1/transfers/latest` | `http://localhost:3000/api/v1/transfers/latest` | Les 20 transferts les plus récents |
| `/api/v1/search` | `http://localhost:3000/api/v1/search?q=ferrari` | Recherche combinée |

> `:id` accepte un **cuid ou un slug** (ex. `max-verstappen`, `circuit-de-spa-francorchamps`) ; `:slug` est le slug du championnat (ex. `wec`).

### Santé

#### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-06-28T20:13:30.469Z", "version": "0.1.0" }
```

### Pilotes

#### `GET /api/v1/drivers`

Liste paginée. Paramètres : `page`, `limit`, `series` (slug), `nationality` (ISO alpha-2), `status`.
Chaque pilote inclut un champ calculé `current_entries` (engagements de l'année en cours).

#### `GET /api/v1/drivers/:id`

`:id` accepte un **cuid ou un slug**. Renvoie le profil complet avec les champs calculés :

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
        "category": { "fullName": "Hypercar", "abbreviation": "HYP" }
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

Tous les engagements d'un pilote, toutes saisons et championnats confondus. Filtres optionnels : `?series=wec&season=2026`.

#### `GET /api/v1/drivers/:id/titles`

Le **palmarès** du pilote (titres de champion), du plus récent au plus ancien. Le profil complet (`GET /api/v1/drivers/:id`) embarque aussi `titles` et `titles_count`.

#### `GET /api/v1/drivers/search?q=`

Recherche texte (2 caractères min) sur `firstName`, `lastName` et `nickname`.

### Écuries

#### `GET /api/v1/teams`

Paginée. Filtres : `series`, `country`, `status`.

#### `GET /api/v1/teams/:id`

`:id` accepte cuid ou slug. Renvoie l'écurie avec `current_entries` et une liste dédoublonnée `current_drivers` pour la saison en cours.

#### `GET /api/v1/teams/:id/drivers`

Pilotes de la saison en cours pour l'écurie.

#### `GET /api/v1/teams/:id/transfers`

Transferts entrants/sortants de l'écurie. Filtre optionnel : `?season=2026`.

### Championnats & saisons

#### `GET /api/v1/series`

Tous les championnats avec leur niveau de couverture de données et des compteurs.

#### `GET /api/v1/series/:slug`

Détail d'un championnat avec ses catégories et un résumé `current_season`.

#### `GET /api/v1/seasons` · `GET /api/v1/seasons/:id`

Liste/détail des saisons. Filtres de liste : `series`, `year`.

### Catégories

#### `GET /api/v1/categories`

Toutes les classes/catégories de tous les championnats (Hypercar, LMGT3, GTP, F1…), avec leur série et un compteur d'engagements. Filtre optionnel `?series=<slug>` pour se limiter à un championnat.

### Stats

#### `GET /api/v1/stats`

Totaux globaux. `drivers` est le nombre de pilotes **uniques**, toutes séries et catégories confondues (une ligne par personne).

```json
{ "data": { "drivers": 34, "teams": 18, "series": 7, "categories": 13, "entries": 69, "transfers": 1 } }
```

### Circuits

#### `GET /api/v1/circuits`

Tous les circuits, **par ordre alphabétique**, paginé. Filtres : `country` (ISO alpha-2), `type` (`PERMANENT` / `STREET` / `OVAL` / `ROAD`).

#### `GET /api/v1/circuits/:id`

`:id` accepte un cuid ou un slug, ex. `circuit-de-spa-francorchamps`.

### Constructeurs

#### `GET /api/v1/manufacturers`

Liste paginée des constructeurs.

### Engagements

#### `GET /api/v1/entries`

Paginée. Filtres : `series`, `season`, `team`, `driver`, `category` (abréviation). `team` et `driver` acceptent cuid ou slug.

```bash
curl "http://localhost:3000/api/v1/entries?driver=jules-gounon"
```

### Transferts

#### `GET /api/v1/transfers`

Paginée. Filtres : `series`, `season`, `status`, `team`, `driver`.

#### `GET /api/v1/transfers/latest`

Les 20 transferts les plus récents, tous championnats confondus.

### Recherche

#### `GET /api/v1/search?q=`

Recherche combinée renvoyant `{ "data": { "drivers": [], "teams": [], "series": [] } }`.

---

## Ajouter des données — le guide complet

Tu ne modifies **jamais** de code pour ajouter un pilote, une écurie ou un engagement. **Tu édites un fichier JSON et tu lances une commande.** Toutes les données vivent en JSON sous `prisma/seed/data/` ; le seed les valide et les charge en base.

Il y a deux façons d'alimenter la base :

| Méthode | Ce que ça couvre | Comment |
| --- | --- | --- |
| ✍️ **À la main (fichiers JSON)** | Tout : n'importe quel championnat, écurie, pilote, engagement, transfert | Éditer un fichier dans `prisma/seed/data/`, puis `npm run db:seed` |
| 🤖 **Automatique (F1 uniquement)** | Tous les pilotes, écuries et engagements F1 (2024–2026) | `npm run ingest:single-seaters` |

> L'endurance, le GT et la F2/F3 n'ont pas encore d'API gratuite en masse : on les ajoute **à la main**. La F1 peut être importée **automatiquement** depuis Jolpica + OpenF1 — voir [Importer la F1 automatiquement](#importer-la-f1-automatiquement).

### 📌 Aide-mémoire — quel fichier éditer ?

| Je veux ajouter / modifier… | 📁 Fichier à créer ou éditer | ▶️ Puis lancer |
| --- | --- | --- |
| Un **championnat** (série) | `prisma/seed/data/series.json` | `npm run db:seed` |
| Une **saison** (une année d'une série) | `prisma/seed/data/seasons.json` | `npm run db:seed` |
| Une **classe / catégorie** | `prisma/seed/data/categories.json` | `npm run db:seed` |
| Un **constructeur** | `prisma/seed/data/manufacturers.json` | `npm run db:seed` |
| Un **circuit** | `prisma/seed/data/circuits.json` | `npm run db:seed` |
| Une **écurie** | `prisma/seed/data/teams/<nom-libre>.json` | `npm run db:seed` |
| Un **pilote** | `prisma/seed/data/drivers/<nom-libre>.json` | `npm run db:seed` |
| Un **engagement** (pilote ↔ écurie pour une saison) | `prisma/seed/data/entries/<nom-libre>.json` | `npm run db:seed` |
| Un **transfert** | `prisma/seed/data/transfers/<nom-libre>.json` | `npm run db:seed` |
| Un **titre de pilote** (palmarès) | `prisma/seed/data/titles/<nom-libre>.json` | `npm run db:seed` |
| **Tous les pilotes & écuries F1** | _fichiers auto-générés_ | `npm run ingest:single-seaters` puis `npm run db:seed` |

Chaque fichier est un **tableau JSON** d'objets. Tu peux nommer les fichiers comme tu veux et imbriquer des dossiers librement (`teams/wec.json`, `drivers/f1/2026.json`) — chaque `.json` d'un dossier est chargé.

```
prisma/seed/
├── data/
│   ├── series.json            ← championnats            (fichier simple)
│   ├── seasons.json           ← années de chaque série  (fichier simple)
│   ├── categories.json        ← classes (Hypercar…)     (fichier simple)
│   ├── manufacturers.json     ← constructeurs           (fichier simple)
│   ├── teams/      *.json      ← écuries                 (dossier, libre)
│   ├── drivers/    *.json      ← pilotes                 (dossier, libre)
│   ├── entries/    *.json      ← pilote↔écurie↔saison    (dossier, libre)
│   └── transfers/  *.json      ← mouvements de pilotes   (dossier, libre)
├── seeders/                    un chargeur en masse par entité
├── validation.ts              un jeu de règles de validation par enregistrement
└── index.ts                   charge tout dans le bon ordre
```

### 3 règles à retenir

1. **Tu références les choses par leur clé naturelle, jamais par un ID de base.** Une écurie → son `slug`, une série → son `slug`, une saison → son `year`, une catégorie → son `abbreviation`, un constructeur → son `name`, un pilote → son `slug`.
2. **Les slugs sont générés pour toi** depuis le nom : minuscules, accents retirés, espaces → tirets. `"Genesis Magma Racing"` → `genesis-magma-racing`, `"Jules Gounon"` → `jules-gounon`. Ce slug généré est exactement ce que tu tapes ailleurs pour pointer vers l'enregistrement.
3. **Un pilote `ACTIVE` doit avoir au moins un engagement.** Ajoute le pilote et un engagement dans le même `db:seed`. Un pilote sans baquet doit être `"status": "WITHOUT_SEAT"`. Sinon, le seed refuse de se terminer.

En cas d'erreur, le seed s'arrête et pointe l'endroit exact :
`Invalid record in "drivers/wec.json" [#3]: nationality: Must be a valid ISO 3166-1 alpha-2 country code`.

---

## Comment ajouter une écurie

> 📁 **Fichier :** `prisma/seed/data/teams/<ton-fichier>.json` &nbsp;·&nbsp; ▶️ **Lancer :** `npm run db:seed`

Une écurie est l'organisation qui engage des voitures. Ajoute un objet au tableau.

**Champs obligatoires**

| Champ | Type / règle | Exemple |
| --- | --- | --- |
| `fullName` | texte — le nom officiel | `"Alpine Endurance Team"` |
| `shortName` | texte — nom court d'affichage | `"Alpine"` |
| `country` | ISO 3166-1 **alpha-2** | `"FR"` |

**Champs optionnels :** `primaryColor` & `secondaryColor` (hex `#RRGGBB` — **laisse vide `""` ou omets si tu n'as pas encore les couleurs**), `city`, `foundedYear`, `dissolvedYear`, `officialWebsite`, `instagram`, `twitter`, `status` (`ACTIVE` *défaut* / `INACTIVE` / `MERGED` / `ACQUIRED`), `nameHistory` (`[{ "name": "Lotus F1", "year": 2012 }]`).

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

➡️ Le slug généré de cette écurie est **`alpine-endurance-team`**. C'est la valeur que tu mettras dans `"team"` lors de la création d'un engagement.

**Erreurs fréquentes :** si tu mets une couleur, elle doit faire 6 chiffres hex précédés de `#` (`"#0055A4"`, pas `"0055A4"` ni `"blue"`) — mais tu peux la laisser vide/l'omettre · `country` est le code à 2 lettres, pas le nom complet du pays.

---

## Comment ajouter un pilote

> 📁 **Fichier :** `prisma/seed/data/drivers/<ton-fichier>.json` &nbsp;·&nbsp; ▶️ **Lancer :** `npm run db:seed`

**Champs obligatoires**

| Champ | Type / règle | Exemple |
| --- | --- | --- |
| `firstName` | texte | `"Jules"` |
| `lastName` | texte | `"Gounon"` |
| `nationality` | ISO 3166-1 **alpha-2** | `"AD"` |

**Champs optionnels :** `dateOfBirth` (`"AAAA-MM-JJ"`), `cityOfBirth`, `countryOfBirth` (alpha-2), `racingNumber` (nombre), `nickname`, `shortBio`, `officialWebsite`, `instagram`, `twitter`, `status` (`ACTIVE` *défaut* / `RETIRED` / `DECEASED` / `WITHOUT_SEAT`), et le bloc photo.

**Règles photo (strictes) :**
- `photoUrl` **doit** commencer par `https://upload.wikimedia.org` ou `https://commons.wikimedia.org` — Wikimedia Commons uniquement.
- `photoLicense` vaut `CC0`, `CC_BY` ou `CC_BY_SA`.
- `photographerCredit` est **obligatoire** lorsque `photoLicense` vaut `CC_BY_SA`.
- `photoSourceUrl` doit pointer vers la page source Wikimedia.

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

➡️ Le slug généré de ce pilote est **`jules-gounon`** — la valeur que tu mettras dans `"driver"` au sein d'un engagement.

**Rappel règle n°3 :** un pilote `ACTIVE` a besoin d'un engagement. Ajoute l'engagement ci-dessous dans le même `db:seed`, sinon le seed s'arrête avec une erreur d'intégrité claire.

---

## Comment relier un pilote à une écurie — l'engagement ⭐

> 📁 **Fichier :** `prisma/seed/data/entries/<ton-fichier>.json` &nbsp;·&nbsp; ▶️ **Lancer :** `npm run db:seed`

L'**engagement** (*Entry*) est le cœur de GridBase API : il représente **une voiture** — une écurie, dans une saison, dans un championnat, avec un numéro — et le(s) pilote(s) qui lui sont affectés. C'est ce qui relie un pilote à une écurie. Comme le lien vit sur l'engagement :
- le **même pilote** peut avoir **plusieurs engagements** (championnats différents, ou années différentes), et
- une **seule voiture** peut porter **2 ou 3 pilotes** (endurance).

**Avant de créer un engagement, ceux-ci doivent exister** (les ajouter dans le même `db:seed` suffit — l'ordre entre fichiers n'a pas d'importance) :

| Référencé par l'engagement via… | …doit déjà être défini dans |
| --- | --- |
| `"team"` (slug) | `teams/…json` |
| `"driver"` (slug) | `drivers/…json` |
| `"series"` (slug) | `series.json` |
| `"season"` (année) | `seasons.json` |
| `"category"` (abréviation, optionnel) | `categories.json` |
| `"manufacturer"` (nom, optionnel) | `manufacturers.json` |

**Champs d'un engagement**

| Champ | Obligatoire | Notes |
| --- | --- | --- |
| `team` | ✅ | **slug** d'écurie |
| `series` | ✅ | **slug** de série |
| `season` | ✅ | année en **nombre**, ex. `2026` |
| `carNumber` | ✅ | texte, ex. `"19"` (unique par saison) |
| `drivers` | ✅ | tableau — au moins un (voir ci-dessous) |
| `category` | — | **abréviation** de classe, ex. `"HYP"` |
| `manufacturer` | — | **nom** du constructeur, ex. `"Genesis"` |
| `chassis` | — | ex. `"Alpine A424"` |
| `status` | — | `CONFIRMED` *défaut* / `RUMOUR` / `CANCELLED` / `WITHDRAWN` |
| `announcedAt`, `sourceUrl` | — | métadonnées |

**Chaque élément de `drivers` :** `driver` (✅ slug), `role` (`TITULAR` *défaut* / `REPLACEMENT` / `ENDURANCE_ONLY` / `GUEST`), `isPrimary` (booléen — le pilote vedette), `wecClassification` (`PLATINUM` / `GOLD` / `SILVER` / `BRONZE`).

### Monoplace (F1, F2, F3) — un pilote

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

> Pour la F1, tu n'écris normalement pas ça à la main — `npm run ingest:single-seaters` crée tous les engagements F1 pour toi.

### Endurance (WEC, IMSA) — deux ou trois pilotes

Les voitures Hypercar et LMGT3 du WEC sont partagées par un équipage. La **classification WEC** (Platinum / Gold / Silver / Bronze) note chaque pilote : les équipages LMGT3 doivent équilibrer les notes, tandis que les équipages Hypercar sont en général entièrement Platinum.

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

### Multi-championnat — le même pilote, un second engagement

Un pilote présent dans deux programmes obtient simplement un **second engagement**. Rien ne change sur la fiche du pilote ; `is_multi_series` passe à `true` automatiquement. Ajoute juste un autre objet (il peut vivre dans le même fichier) :

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

## Comment enregistrer un transfert

> 📁 **Fichier :** `prisma/seed/data/transfers/<ton-fichier>.json` &nbsp;·&nbsp; ▶️ **Lancer :** `npm run db:seed`

Un **transfert** (*Transfer*) enregistre un *changement* — un pilote qui change d'écurie ou de championnat, prend sa retraite ou fait son retour. Ce n'est **pas** la même chose qu'un engagement :
- un **engagement** = un fait sur une saison (« qui est dans quelle voiture »),
- un **transfert** = une actualité de mouvement (« le pilote X rejoint l'écurie Y pour 2026 »).

**Obligatoire :** `driver` (slug). **Optionnels :** `fromTeam` / `toTeam` (slugs d'écurie), `fromSeries` / `toSeries` (slugs de série), `season` (texte, `"2026"`), `announcedAt`, `effectiveAt`, `status` (`RUMOUR` *défaut* → `CONFIRMED` → `OFFICIAL`, ou `CANCELLED`), `type` (`TRANSFER` *défaut* / `RETIREMENT` / `COMEBACK` / `REPLACEMENT` / `LOAN`), `sourceUrl`, `notes`.

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

## Exemple complet — un nouveau pilote dans une voiture

Objectif : ajouter **Théo Pourchaire** chez **ART Grand Prix** en F2 2026.
La série `f2`, sa catégorie `F2` et sa saison 2026 sont déjà déclarées dans les fichiers de référence, donc on ajoute juste une écurie, un pilote, et l'engagement qui relie le tout. Trois fichiers, une commande.

**1.** Ajoute l'écurie — `prisma/seed/data/teams/f2.json` :
```json
[{ "fullName": "ART Grand Prix", "shortName": "ART", "country": "FR", "primaryColor": "#000000" }]
```

**2.** Ajoute le pilote — `prisma/seed/data/drivers/f2.json` :
```json
[{ "firstName": "Théo", "lastName": "Pourchaire", "nationality": "FR", "status": "ACTIVE" }]
```

**3.** Relie-les avec un engagement — `prisma/seed/data/entries/f2-2026.json` :
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

**4.** Lance le seed :
```bash
npm run db:seed
```

Vérifie le résultat : `GET /api/v1/drivers/theo-pourchaire` montre ART Grand Prix dans `current_entries`, et `GET /api/v1/teams/art-grand-prix` liste le pilote. ✅

---

## Importer la F1 automatiquement

Plutôt que d'écrire la F1 à la main, **génère les fichiers JSON** depuis les API publiques :

```bash
npm run ingest:single-seaters   # 1. écrit les fichiers F1 dans prisma/seed/data/
npm run db:seed                 # 2. charge tout (F1 incluse) en base
```

L'ingest **ne touche pas** à la base — il **écrit seulement des fichiers JSON**, exactement comme ceux faits à la main, donc il n'y a qu'**une seule source de vérité** (les fichiers, versionnés dans git) :

```
prisma/seed/data/drivers/f1.json
prisma/seed/data/teams/f1.json
prisma/seed/data/entries/f1-2024.json · f1-2025.json · f1-2026.json
```

Il récupère pilotes, écuries et engagements de 2024 à 2026 depuis l'API gratuite **Jolpica** (le successeur d'Ergast) et utilise **OpenF1** pour des numéros de voiture exacts par saison. La sortie est déterministe (triée) pour des diffs git propres : tu peux le relancer pour rafraîchir les données et relire les changements. Tu peux aussi éditer les fichiers générés à la main ensuite. La F2/F3 n'est pas générée (aucune API gratuite de liste d'engagés) — ajoute-la à la main. Les détails sont documentés en tête de `scripts/ingest-single-seaters.ts`.

---

## Contribuer

Les contributions sont les bienvenues — corrections de données, nouveaux championnats et code. Merci de garder des données sourcées et vérifiables : chaque engagement et chaque transfert doit porter un `sourceUrl` quand c'est possible, et les photos de pilotes doivent provenir de Wikimedia Commons avec une licence correcte. Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md) pour la philosophie complète (l'exactitude avant le volume, les sources avant les suppositions) et un guide pas-à-pas pour ajouter des données.

## Licence

- **Code :** GNU Affero General Public License v3.0 (AGPL-3.0) — voir [`LICENSE`](./LICENSE)
- **Données :** Creative Commons Attribution 4.0 (CC BY 4.0) — voir [`LICENSE-DATA`](./LICENSE-DATA)

## Feuille de route

- API d'écriture (`POST`/`PATCH`) avec authentification
- Résultats et classements par saison
- Circuits et calendrier/épreuves
- Ingestion automatisée depuis Jolpica (F1) et OpenF1
- Documentation OpenAPI / Swagger
- Instance publique hébergée
