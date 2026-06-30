import { z } from 'zod';
import {
  hexColorSchema,
  isoCountrySchema,
  isWikimediaUrl,
  optionalHexColorSchema,
} from '../../src/schemas/common';

// Re-use the very same validation rules the API enforces, so seed data can
// never be "more lax" than what a future write endpoint would accept.

export const seriesDataSchema = z.object({
  slug: z.string().min(1),
  fullName: z.string().min(1),
  shortName: z.string().min(1),
  organiser: z.string().optional(),
  category: z.enum(['SINGLE_SEATER', 'ENDURANCE', 'GT', 'TOURING', 'RALLY', 'OTHER']),
  website: z.string().url().optional(),
  country: isoCountrySchema.optional(),
  isActive: z.boolean().default(true),
  dataSource: z.enum(['JOLPICA', 'OPENF1', 'COMMUNITY', 'MANUAL']).default('COMMUNITY'),
  dataCoverage: z.string().optional(),
});
export type SeriesData = z.infer<typeof seriesDataSchema>;

export const seasonDataSchema = z.object({
  series: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  plannedRounds: z.number().int().positive().optional(),
  actualRounds: z.number().int().positive().optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'FINISHED', 'CANCELLED']).default('UPCOMING'),
  regulationUrl: z.string().url().optional(),
});
export type SeasonData = z.infer<typeof seasonDataSchema>;

export const categoryDataSchema = z.object({
  series: z.string().min(1),
  fullName: z.string().min(1),
  abbreviation: z.string().min(1),
  description: z.string().optional(),
  hierarchy: z.number().int().positive(),
  displayColor: hexColorSchema.optional(),
  isActive: z.boolean().default(true),
});
export type CategoryData = z.infer<typeof categoryDataSchema>;

export const manufacturerDataSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ENGINE_SUPPLIER', 'CHASSIS_CONSTRUCTOR', 'BOTH']),
  country: isoCountrySchema,
  website: z.string().url().optional(),
  isActive: z.boolean().default(true),
});
export type ManufacturerData = z.infer<typeof manufacturerDataSchema>;

export const teamDataSchema = z.object({
  fullName: z.string().min(1).max(150),
  shortName: z.string().min(1).max(80),
  country: isoCountrySchema,
  city: z.string().optional(),
  primaryColor: optionalHexColorSchema,
  secondaryColor: optionalHexColorSchema,
  foundedYear: z.number().int().min(1900).max(2100).optional(),
  dissolvedYear: z.number().int().min(1900).max(2100).optional(),
  officialWebsite: z.string().url().optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MERGED', 'ACQUIRED']).default('ACTIVE'),
  nameHistory: z.array(z.object({ name: z.string(), year: z.number().int() })).optional(),
});
export type TeamData = z.infer<typeof teamDataSchema>;

export const driverDataSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    nationality: isoCountrySchema,
    dateOfBirth: z.string().optional(),
    cityOfBirth: z.string().optional(),
    countryOfBirth: isoCountrySchema.optional(),
    racingNumber: z.number().int().min(0).max(999).optional(),
    nickname: z.string().optional(),
    shortBio: z.string().optional(),
    officialWebsite: z.string().url().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    status: z.enum(['ACTIVE', 'RETIRED', 'DECEASED', 'WITHOUT_SEAT']).default('ACTIVE'),
    photoUrl: z
      .string()
      .url()
      .refine(isWikimediaUrl, {
        message: 'photoUrl must be hosted on Wikimedia Commons',
      })
      .optional(),
    photoLicense: z.enum(['CC0', 'CC_BY', 'CC_BY_SA']).optional(),
    photographerCredit: z.string().optional(),
    photoSourceUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.photoLicense === 'CC_BY_SA' && !data.photographerCredit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['photographerCredit'],
        message: 'photographerCredit is required when photoLicense is CC_BY_SA',
      });
    }
  });
export type DriverData = z.infer<typeof driverDataSchema>;

export const entryDriverDataSchema = z.object({
  driver: z.string().min(1),
  role: z.enum(['TITULAR', 'REPLACEMENT', 'ENDURANCE_ONLY', 'GUEST']).default('TITULAR'),
  isPrimary: z.boolean().default(false),
  wecClassification: z.enum(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE']).optional(),
});

export const entryDataSchema = z.object({
  team: z.string().min(1),
  series: z.string().min(1),
  season: z.number().int().min(1900).max(2100),
  category: z.string().optional(),
  carNumber: z.string().min(1).max(10),
  chassis: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.enum(['CONFIRMED', 'RUMOUR', 'CANCELLED', 'WITHDRAWN']).default('CONFIRMED'),
  announcedAt: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  drivers: z.array(entryDriverDataSchema).min(1),
});
export type EntryData = z.infer<typeof entryDataSchema>;

export const titleDataSchema = z.object({
  driver: z.string().min(1), // driver slug
  year: z.number().int().min(1900).max(2100),
  series: z.string().min(1), // championship name
  category: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});
export type TitleData = z.infer<typeof titleDataSchema>;

export const circuitDataSchema = z.object({
  name: z.string().min(1).max(150),
  country: isoCountrySchema,
  city: z.string().optional(),
  type: z.enum(['PERMANENT', 'STREET', 'OVAL', 'ROAD']).default('PERMANENT'),
  lengthKm: z.number().positive().optional(),
  turns: z.number().int().positive().optional(),
  openedYear: z.number().int().min(1800).max(2100).optional(),
  website: z.string().url().optional(),
});
export type CircuitData = z.infer<typeof circuitDataSchema>;

export const transferDataSchema = z.object({
  driver: z.string().min(1),
  fromTeam: z.string().optional(),
  toTeam: z.string().optional(),
  fromSeries: z.string().optional(),
  toSeries: z.string().optional(),
  season: z.string().optional(),
  announcedAt: z.string().optional(),
  effectiveAt: z.string().optional(),
  status: z.enum(['RUMOUR', 'CONFIRMED', 'OFFICIAL', 'CANCELLED']).default('RUMOUR'),
  type: z.enum(['TRANSFER', 'RETIREMENT', 'COMEBACK', 'REPLACEMENT', 'LOAN']).default('TRANSFER'),
  sourceUrl: z.string().url().optional(),
  notes: z.string().optional(),
});
export type TransferData = z.infer<typeof transferDataSchema>;
