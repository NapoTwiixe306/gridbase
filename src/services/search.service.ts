import { PrismaClient } from '@prisma/client';

export interface CombinedSearchResult {
  drivers: unknown[];
  teams: unknown[];
  series: unknown[];
}

export class SearchService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Combined search across drivers, teams and series. */
  async search(q: string): Promise<CombinedSearchResult> {
    const [drivers, teams, series] = await Promise.all([
      this.prisma.driver.findMany({
        where: {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { nickname: { contains: q } },
          ],
        },
        take: 15,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          slug: true,
          nationality: true,
          status: true,
        },
      }),
      this.prisma.team.findMany({
        where: {
          OR: [{ fullName: { contains: q } }, { shortName: { contains: q } }],
        },
        take: 15,
        select: { id: true, fullName: true, shortName: true, slug: true, country: true },
      }),
      this.prisma.series.findMany({
        where: {
          OR: [{ fullName: { contains: q } }, { shortName: { contains: q } }],
        },
        take: 15,
        select: { id: true, fullName: true, shortName: true, slug: true, category: true },
      }),
    ]);

    return { drivers, teams, series };
  }
}
