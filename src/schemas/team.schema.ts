import { z } from 'zod';
import { isoCountrySchema, optionalHexColorSchema, paginationSchema } from './common';

export const teamStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'MERGED', 'ACQUIRED']);

export const nameHistoryEntrySchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
});

export const teamInputSchema = z.object({
  fullName: z.string().min(1).max(150),
  shortName: z.string().min(1).max(80),
  country: isoCountrySchema,
  city: z.string().max(120).optional(),
  primaryColor: optionalHexColorSchema,
  secondaryColor: optionalHexColorSchema,
  foundedYear: z.number().int().min(1900).max(2100).optional(),
  dissolvedYear: z.number().int().min(1900).max(2100).optional(),
  officialWebsite: z.string().url().optional(),
  instagram: z.string().max(120).optional(),
  twitter: z.string().max(120).optional(),
  status: teamStatusSchema.default('ACTIVE'),
  nameHistory: z.array(nameHistoryEntrySchema).optional(),
});

export type TeamInput = z.infer<typeof teamInputSchema>;

export const teamListQuerySchema = paginationSchema.extend({
  series: z.string().min(1).optional(),
  country: isoCountrySchema.optional(),
  status: teamStatusSchema.optional(),
});

export type TeamListQuery = z.infer<typeof teamListQuerySchema>;

export const teamTransfersQuerySchema = z.object({
  season: z.string().min(1).optional(),
});

export type TeamTransfersQuery = z.infer<typeof teamTransfersQuerySchema>;
