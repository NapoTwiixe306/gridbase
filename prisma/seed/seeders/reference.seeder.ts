import { join } from 'node:path';
import { SeedContext } from '../context';
import { DATA_DIR, loadAndValidate, resolve } from '../helpers';
import {
  categoryDataSchema,
  manufacturerDataSchema,
  seasonDataSchema,
  seriesDataSchema,
} from '../validation';

/**
 * Reference data (series, seasons, categories, manufacturers) is low-volume and
 * referenced by everything else, so it is upserted (insert-or-update) and its
 * IDs are cached in the context.
 */
export async function seedSeries(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'series.json'), seriesDataSchema);
  for (const r of records) {
    const row = await ctx.prisma.series.upsert({
      where: { slug: r.slug },
      update: r,
      create: r,
    });
    ctx.series.set(r.slug, row.id);
  }
  return records.length;
}

export async function seedSeasons(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'seasons.json'), seasonDataSchema);
  for (const r of records) {
    const seriesId = resolve(ctx.series, r.series, 'series');
    const { series: _series, ...data } = r;
    const row = await ctx.prisma.season.upsert({
      where: { seriesId_year: { seriesId, year: r.year } },
      update: { ...data, seriesId },
      create: { ...data, seriesId },
    });
    ctx.seasons.set(`${r.series}:${r.year}`, row.id);
  }
  return records.length;
}

export async function seedCategories(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'categories.json'), categoryDataSchema);
  for (const r of records) {
    const seriesId = resolve(ctx.series, r.series, 'series');
    const { series: _series, ...data } = r;
    const row = await ctx.prisma.category.upsert({
      where: { seriesId_abbreviation: { seriesId, abbreviation: r.abbreviation } },
      update: { ...data, seriesId },
      create: { ...data, seriesId },
    });
    ctx.categories.set(`${r.series}:${r.abbreviation}`, row.id);
  }
  return records.length;
}

export async function seedManufacturers(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'manufacturers.json'), manufacturerDataSchema);
  for (const r of records) {
    const row = await ctx.prisma.manufacturer.upsert({
      where: { name: r.name },
      update: r,
      create: r,
    });
    ctx.manufacturers.set(r.name, row.id);
  }
  return records.length;
}
