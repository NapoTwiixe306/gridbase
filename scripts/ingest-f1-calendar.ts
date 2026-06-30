/**
 * Auto-updating F1 calendar: fetches the dated schedule from Jolpica and writes
 * prisma/seed/data/calendar/f1-<year>.json with real race dates. Re-running it
 * refreshes the dates (a scheduled GitHub Action commits any changes), so the
 * F1 calendar stays current without manual work. Then `npm run db:seed` loads it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const DATA = join(__dirname, '..', 'prisma', 'seed', 'data');
const YEAR = Number(process.env.F1_YEAR) || new Date().getFullYear();

// Ergast/Jolpica circuitId -> our circuit slug (from circuits.json).
const CIRCUIT_MAP: Record<string, string> = {
  albert_park: 'albert-park-circuit',
  shanghai: 'shanghai-international-circuit',
  suzuka: 'suzuka-international-racing-course',
  bahrain: 'bahrain-international-circuit',
  jeddah: 'jeddah-corniche-circuit',
  miami: 'miami-international-autodrome',
  villeneuve: 'circuit-gilles-villeneuve',
  monaco: 'circuit-de-monaco',
  catalunya: 'circuit-de-barcelona-catalunya',
  red_bull_ring: 'red-bull-ring',
  silverstone: 'silverstone-circuit',
  spa: 'circuit-de-spa-francorchamps',
  hungaroring: 'hungaroring',
  zandvoort: 'circuit-zandvoort',
  monza: 'autodromo-nazionale-monza',
  madring: 'madring',
  baku: 'baku-city-circuit',
  marina_bay: 'marina-bay-street-circuit',
  americas: 'circuit-of-the-americas',
  rodriguez: 'autodromo-hermanos-rodriguez',
  interlagos: 'autodromo-jose-carlos-pace',
  vegas: 'las-vegas-strip-circuit',
  losail: 'losail-international-circuit',
  yas_marina: 'yas-marina-circuit',
  imola: 'autodromo-internazionale-enzo-e-dino-ferrari',
  portimao: 'algarve-international-circuit',
  mugello: 'mugello-circuit',
  istanbul: 'istanbul-park',
  hockenheimring: 'hockenheimring',
  nurburgring: 'nurburgring',
  ricard: 'circuit-paul-ricard',
  sochi: 'sochi-autodrom',
};

interface ErgastRace {
  round: string;
  raceName: string;
  date: string;
  Circuit: { circuitId: string };
}
interface ErgastResponse {
  MRData: { RaceTable: { Races: ErgastRace[] } };
}

async function main(): Promise<void> {
  const res = await fetch(`${JOLPICA_BASE}/${YEAR}/races/?format=json&limit=40`, {
    headers: { 'User-Agent': 'GridBase/0.1 (calendar)' },
  });
  if (!res.ok) throw new Error(`Jolpica request failed: ${res.status}`);
  const races = ((await res.json()) as ErgastResponse).MRData.RaceTable.Races;

  if (races.length === 0) {
    console.log(`No F1 schedule for ${YEAR} yet — nothing written.`);
    return;
  }

  const records = races.map((r) => {
    const circuit = CIRCUIT_MAP[r.Circuit.circuitId];
    if (!circuit) {
      throw new Error(
        `Unmapped F1 circuit "${r.Circuit.circuitId}" — add it to CIRCUIT_MAP (and circuits.json).`,
      );
    }
    return {
      series: 'f1',
      season: YEAR,
      round: Number(r.round),
      circuit,
      name: r.raceName,
      startDate: r.date,
      endDate: r.date,
    };
  });

  const rel = `calendar/f1-${YEAR}.json`;
  const full = join(DATA, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`📝 ${rel} — ${records.length} dated rounds (source: Jolpica).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
