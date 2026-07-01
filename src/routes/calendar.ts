import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const upcomingQuerySchema = z.object({
  series: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const icsQuerySchema = z.object({
  series: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/calendar/upcoming — next races across all series (or one),
  // ordered by date. Powers a landing page "next races" / a calendar view.
  app.get('/upcoming', async (request) => {
    const { series, limit } = upcomingQuerySchema.parse(request.query);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rounds = await app.prisma.round.findMany({
      where: {
        OR: [{ startDate: { gte: today } }, { endDate: { gte: today } }],
        ...(series ? { season: { series: { slug: series } } } : {}),
      },
      orderBy: [{ startDate: 'asc' }],
      take: limit,
      include: {
        circuit: true,
        season: { include: { series: { select: { slug: true, shortName: true } } } },
      },
    });

    const data = rounds.map((r) => ({
      series: r.season.series.slug,
      seriesName: r.season.series.shortName,
      season: r.season.year,
      round: r.roundNumber,
      name: r.name,
      startDate: r.startDate,
      endDate: r.endDate,
      circuit: {
        name: r.circuit.name,
        slug: r.circuit.slug,
        country: r.circuit.country,
        city: r.circuit.city,
      },
    }));

    return { data };
  });

  // GET /api/v1/calendar/ics — subscribe/import the calendar into Google
  // Calendar, Apple Calendar, etc. Returns dated all-day events for each round.
  app.get('/ics', async (request, reply) => {
    const { series, limit } = icsQuerySchema.parse(request.query);

    const rounds = await app.prisma.round.findMany({
      where: {
        startDate: { not: null },
        ...(series ? { season: { series: { slug: series } } } : {}),
      },
      orderBy: [{ startDate: 'asc' }],
      take: limit,
      include: {
        circuit: true,
        season: { include: { series: { select: { slug: true, shortName: true } } } },
      },
    });

    const calName = series ? `GridBase — ${series}` : 'GridBase — Motorsport';
    const ics = buildIcs(
      calName,
      rounds.map((r) => ({
        uid: `${r.id}@gridbase`,
        summary: `${r.season.series.shortName} — ${r.name ?? r.circuit.name}`,
        location: [r.circuit.name, r.circuit.city, r.circuit.country].filter(Boolean).join(', '),
        start: r.startDate as Date,
        end: r.endDate ?? (r.startDate as Date),
      })),
    );

    const fileName = series ? `gridbase-${series}.ics` : 'gridbase-calendar.ics';
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(ics);
  });
}

interface IcsEvent {
  uid: string;
  summary: string;
  location: string;
  start: Date;
  end: Date;
}

/** Escape a text value per RFC 5545 (commas, semicolons, backslashes, newlines). */
function escapeIcs(text: string): string {
  return text.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
}

/** Format a Date as an all-day DATE value (YYYYMMDD, UTC). */
function icsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Add one day — DTEND is exclusive for all-day events. */
function nextDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function buildIcs(calendarName: string, events: IcsEvent[]): string {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GridBase API//Motorsport Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDay(e.end))}`,
      `SUMMARY:${escapeIcs(e.summary)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  // RFC 5545 mandates CRLF line endings.
  return `${lines.join('\r\n')}\r\n`;
}
