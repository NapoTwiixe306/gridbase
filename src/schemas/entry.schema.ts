import { z } from 'zod';
import { paginationSchema } from './common';

export const entryStatusSchema = z.enum(['CONFIRMED', 'RUMOUR', 'CANCELLED', 'WITHDRAWN']);

export const driverRoleSchema = z.enum(['TITULAR', 'REPLACEMENT', 'ENDURANCE_ONLY', 'GUEST']);

export const wecClassificationSchema = z.enum(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE']);

export const entryDriverInputSchema = z.object({
  driverId: z.string().min(1),
  role: driverRoleSchema.default('TITULAR'),
  isPrimary: z.boolean().default(false),
  wecClassification: wecClassificationSchema.optional(),
});

export const entryInputSchema = z.object({
  teamId: z.string().min(1),
  seasonId: z.string().min(1),
  seriesId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  carNumber: z.string().min(1).max(10),
  chassis: z.string().max(120).optional(),
  manufacturerId: z.string().min(1).optional(),
  status: entryStatusSchema.default('CONFIRMED'),
  announcedAt: z.coerce.date().optional(),
  sourceUrl: z.string().url().optional(),
  drivers: z.array(entryDriverInputSchema).min(1),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryListQuerySchema = paginationSchema.extend({
  series: z.string().min(1).optional(),
  season: z.coerce.number().int().min(1900).max(2100).optional(),
  team: z.string().min(1).optional(),
  driver: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

export type EntryListQuery = z.infer<typeof entryListQuerySchema>;
