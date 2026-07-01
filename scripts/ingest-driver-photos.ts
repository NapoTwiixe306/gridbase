/**
 * Enrich driver seed FILES with free-licensed portrait photos from Wikimedia.
 *
 * Like the other ingest scripts, this does NOT touch the database. It reads the
 * hand-authored driver files under `prisma/seed/data/drivers/`, looks each
 * driver up on Wikidata, resolves their portrait (P18) on Wikimedia Commons,
 * and writes back `photoUrl` / `photoLicense` / `photographerCredit` /
 * `photoSourceUrl` in place. Then load the DB the normal way:
 *
 *   npm run ingest:driver-photos            → enrich every driver file
 *   npm run ingest:driver-photos -- --file=f1
 *   npm run ingest:driver-photos -- --limit=25
 *   npm run ingest:driver-photos -- --force  → re-fetch even if a photo exists
 *   npm run db:seed                          → load everything into the DB
 *
 * LEGAL — zero-risk by construction:
 *   • Photos are sourced ONLY from Wikimedia Commons (upload.wikimedia.org),
 *     matching the `isWikimediaUrl` guard enforced by the seed validator.
 *   • ONLY free licences are accepted: CC0, CC-BY, CC-BY-SA. Anything else
 *     (non-free, fair-use, "all rights reserved", unknown) is skipped.
 *   • The photographer credit (Commons "Artist" field) is always captured and
 *     is REQUIRED for CC-BY / CC-BY-SA; such photos are skipped if it's missing.
 *
 * DATA SOURCES:
 *   • Wikidata Action API (wbsearchentities + wbgetentities) — resolve the
 *     person and their P18 (image) claim.
 *   • Wikimedia Commons Action API (imageinfo) — resolve a 400px thumbnail URL,
 *     licence (extmetadata.LicenseShortName), author (extmetadata.Artist) and
 *     the Commons file page (descriptionurl).
 *
 * The output is written back to the SAME files with a stable field order, so
 * git diffs stay clean and re-runs are idempotent (drivers that already have a
 * photoUrl are skipped unless --force is given).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DRIVERS_DIR = join(__dirname, '..', 'prisma', 'seed', 'data', 'drivers');
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT =
  'GridBase-API/0.1 (driver-photos; https://github.com/NapoTwiixe306/gridbase-api)';
const THUMB_WIDTH = 400;
const REQUEST_DELAY_MS = 200; // be polite to Wikimedia

type PhotoLicense = 'CC0' | 'CC_BY' | 'CC_BY_SA';

/** A driver record as stored in the seed JSON (only the fields we read/write). */
interface DriverRecord {
  firstName: string;
  lastName: string;
  status?: string;
  photoUrl?: string;
  photoLicense?: PhotoLicense;
  photographerCredit?: string;
  photoSourceUrl?: string;
  [key: string]: unknown;
}

interface SearchResult {
  id: string;
  label?: string;
  description?: string;
}

// A Wikidata entity description that reliably means "this is a racing driver".
// Used to reject same-name homonyms (actors, politicians…) so we never attach
// the wrong person's photo.
const RACING_RE =
  /racing|driver|formula|motorsport|nascar|indycar|rally|karting|le mans|pilote|endurance|motor racing|race car/i;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const FILE_FILTER = argValue('--file'); // e.g. "f1" → only drivers/f1.json
const LIMIT = Number(argValue('--limit') ?? 'Infinity');

function argValue(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit?.split('=')[1];
}

async function fetchJson<T>(base: string, params: Record<string, string>): Promise<T> {
  const url = `${base}?${new URLSearchParams({ format: 'json', ...params }).toString()}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(1000 * attempt);
      continue;
    }
    throw new Error(`Request failed ${res.status} for ${url}`);
  }
  throw new Error(`Request failed after retries: ${url}`);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Normalise a name for loose comparison (lowercase, no diacritics/punctuation). */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Find the Wikidata QID for a driver, guarding against same-name homonyms. */
async function resolveWikidataId(driver: DriverRecord): Promise<string | null> {
  const fullName = `${driver.firstName} ${driver.lastName}`;
  const data = await fetchJson<{ search: SearchResult[] }>(WIKIDATA_API, {
    action: 'wbsearchentities',
    search: fullName,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '7',
  });

  const wantLast = norm(driver.lastName);
  const wantFull = norm(fullName);

  // Prefer a candidate that both looks like a racing driver AND matches the name.
  const racing = data.search.filter((c) => RACING_RE.test(c.description ?? ''));
  const byName = (c: SearchResult): boolean => {
    const label = norm(c.label ?? '');
    return label === wantFull || (label.includes(wantLast) && wantLast.length > 2);
  };

  return racing.find(byName)?.id ?? racing[0]?.id ?? null;
}

/** The Commons filename from a Wikidata entity's P18 (image) claim, if any. */
async function resolveImageFilename(qid: string): Promise<string | null> {
  const data = await fetchJson<{
    entities: Record<
      string,
      { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }
    >;
  }>(WIKIDATA_API, { action: 'wbgetentities', ids: qid, props: 'claims' });

  const p18 = data.entities[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return typeof p18 === 'string' ? p18 : null;
}

interface CommonsPhoto {
  photoUrl: string;
  photoLicense: PhotoLicense;
  photographerCredit?: string;
  photoSourceUrl: string;
}

/** Map a Commons LicenseShortName to our enum, or null if not a free licence. */
function mapLicense(shortName: string | undefined): PhotoLicense | null {
  const s = (shortName ?? '').toUpperCase().replace(/\s+/g, '-');
  if (s.includes('CC0') || s.includes('PUBLIC-DOMAIN') || s === 'PD' || s.includes('PDM'))
    return 'CC0';
  if (s.includes('BY-SA')) return 'CC_BY_SA';
  if (s.includes('BY')) return 'CC_BY';
  return null; // non-free / unknown → reject
}

/** Strip HTML from a Commons "Artist" field down to a plain, trimmed credit. */
function cleanArtist(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text.slice(0, 255) : undefined;
}

/** Resolve a free-licensed thumbnail + attribution for a Commons file. */
async function resolveCommonsPhoto(filename: string): Promise<CommonsPhoto | null> {
  const data = await fetchJson<{
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: {
            thumburl?: string;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }[];
        }
      >;
    };
  }>(COMMONS_API, {
    action: 'query',
    titles: `File:${filename}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  });

  const pages = data.query?.pages ?? {};
  const info = Object.values(pages)[0]?.imageinfo?.[0];
  if (!info?.thumburl || !info.descriptionurl) return null;

  const license = mapLicense(info.extmetadata?.LicenseShortName?.value);
  if (!license) return null;

  const credit = cleanArtist(info.extmetadata?.Artist?.value);
  // Attribution licences MUST carry a credit, otherwise we can't use the photo.
  if ((license === 'CC_BY' || license === 'CC_BY_SA') && !credit) return null;

  return {
    photoUrl: info.thumburl,
    photoLicense: license,
    photographerCredit: credit,
    photoSourceUrl: info.descriptionurl,
  };
}

/** Rewrite a record with photo fields injected in a stable position. */
function withPhoto(record: DriverRecord, photo: CommonsPhoto): DriverRecord {
  const { photoUrl, photoLicense, photographerCredit, photoSourceUrl, ...rest } = record;
  return {
    ...rest,
    photoUrl: photo.photoUrl,
    photoLicense: photo.photoLicense,
    ...(photo.photographerCredit ? { photographerCredit: photo.photographerCredit } : {}),
    photoSourceUrl: photo.photoSourceUrl,
  };
}

async function processFile(fileName: string, budget: { left: number }): Promise<void> {
  const path = join(DRIVERS_DIR, fileName);
  const records = JSON.parse(readFileSync(path, 'utf-8')) as DriverRecord[];
  let added = 0;
  let changed = false;

  for (let i = 0; i < records.length; i += 1) {
    if (budget.left <= 0) break;
    const driver = records[i];
    if (driver.photoUrl && !FORCE) continue;
    budget.left -= 1;

    const name = `${driver.firstName} ${driver.lastName}`;
    try {
      const qid = await resolveWikidataId(driver);
      if (!qid) continue;
      await sleep(REQUEST_DELAY_MS);

      const filename = await resolveImageFilename(qid);
      if (!filename) continue;
      await sleep(REQUEST_DELAY_MS);

      const photo = await resolveCommonsPhoto(filename);
      if (!photo) continue;

      records[i] = withPhoto(driver, photo);
      changed = true;
      added += 1;
      console.log(`  ✅ ${name} — ${photo.photoLicense}`);
    } catch (error) {
      console.warn(`  ⚠️  ${name}: ${(error as Error).message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (changed) {
    writeFileSync(path, `${JSON.stringify(records, null, 2)}\n`);
  }
  console.log(`📝 ${fileName} — +${added} photos`);
}

async function main(): Promise<void> {
  console.log('🏁 GridBase API — enriching driver photos from Wikimedia Commons\n');

  let files = readdirSync(DRIVERS_DIR).filter((f) => f.endsWith('.json'));
  if (FILE_FILTER) {
    const wanted = FILE_FILTER.endsWith('.json') ? FILE_FILTER : `${FILE_FILTER}.json`;
    files = files.filter((f) => f === wanted);
    if (files.length === 0) throw new Error(`No driver file matches --file=${FILE_FILTER}`);
  }

  const budget = { left: LIMIT };
  for (const file of files.sort()) {
    if (budget.left <= 0) break;
    console.log(`🔍 ${file}...`);
    await processFile(file, budget);
  }

  console.log('\n✅ Done. Run `npm run validate:data` then `npm run db:seed` to load.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
