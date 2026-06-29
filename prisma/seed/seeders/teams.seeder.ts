import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SeedContext } from '../context';
import { chunk, DATA_DIR, loadAndValidate, slugify } from '../helpers';
import { teamDataSchema } from '../validation';

const BATCH = 1000;

/**
 * Teams can number in the thousands, so they are bulk-inserted with
 * `createMany` (one statement per batch) and de-duplicated on their unique
 * slug. Existing rows are kept as-is; run `db:reset` for a clean rebuild.
 */
export async function seedTeams(ctx: SeedContext): Promise<number> {
  const records = loadAndValidate(join(DATA_DIR, 'teams'), teamDataSchema);

  const rows: Prisma.TeamCreateManyInput[] = records.map((r) => {
    const { nameHistory, ...rest } = r;
    return {
      ...rest,
      slug: slugify(r.fullName),
      nameHistory: nameHistory ? (nameHistory as Prisma.InputJsonValue) : undefined,
    };
  });

  for (const batch of chunk(rows, BATCH)) {
    await ctx.prisma.team.createMany({ data: batch, skipDuplicates: true });
  }

  // Cache slug -> id for every team referenced by this seed run.
  const slugs = rows.map((r) => r.slug);
  for (const batch of chunk(slugs, BATCH)) {
    const found = await ctx.prisma.team.findMany({
      where: { slug: { in: batch } },
      select: { id: true, slug: true },
    });
    for (const t of found) ctx.teams.set(t.slug, t.id);
  }

  // Distinct slugs = real number of teams (a name can appear in several files,
  // e.g. a team racing in both WEC and IMSA, but it is a single row).
  return new Set(slugs).size;
}
