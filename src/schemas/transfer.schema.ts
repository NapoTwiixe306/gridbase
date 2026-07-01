import { z } from 'zod';
import { paginationSchema } from './common';

export const transferStatusSchema = z.enum(['RUMOUR', 'CONFIRMED', 'OFFICIAL', 'CANCELLED']);

export const transferTypeSchema = z.enum([
  'TRANSFER',
  'RETIREMENT',
  'COMEBACK',
  'REPLACEMENT',
  'LOAN',
]);

export const transferInputSchema = z.object({
  driverId: z.string().min(1),
  fromTeamId: z.string().min(1).optional(),
  toTeamId: z.string().min(1).optional(),
  fromSeriesId: z.string().min(1).optional(),
  toSeriesId: z.string().min(1).optional(),
  season: z.string().min(1).optional(),
  announcedAt: z.coerce.date().optional(),
  effectiveAt: z.coerce.date().optional(),
  status: transferStatusSchema.default('RUMOUR'),
  type: transferTypeSchema.default('TRANSFER'),
  sourceUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export type TransferInput = z.infer<typeof transferInputSchema>;

export const transferListQuerySchema = paginationSchema.extend({
  series: z.string().min(1).optional(),
  season: z.string().min(1).optional(),
  status: transferStatusSchema.optional(),
  team: z.string().min(1).optional(),
  driver: z.string().min(1).optional(),
});

export type TransferListQuery = z.infer<typeof transferListQuerySchema>;

/** Mercato-by-team view: net arrivals/departures for one series + season. */
export const mercatoQuerySchema = z.object({
  series: z.string().min(1),
  season: z.string().min(1),
});

export type MercatoQuery = z.infer<typeof mercatoQuerySchema>;

/** Grid comparator: diff a series' line-up between two seasons. */
export const gridCompareQuerySchema = z.object({
  series: z.string().min(1),
  seasonA: z.coerce.number().int().min(1900).max(2100),
  seasonB: z.coerce.number().int().min(1900).max(2100),
});

export type GridCompareQuery = z.infer<typeof gridCompareQuerySchema>;
