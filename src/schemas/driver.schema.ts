import { z } from 'zod';
import { isoCountrySchema, isWikimediaUrl, paginationSchema } from './common';

export const driverStatusSchema = z.enum(['ACTIVE', 'RETIRED', 'DECEASED', 'WITHOUT_SEAT']);

export const photoLicenseSchema = z.enum(['CC0', 'CC_BY', 'CC_BY_SA']);

/**
 * Validates the input body for creating/updating a driver. Enforces:
 *  - photoUrl, if present, must be a Wikimedia Commons URL
 *  - photographerCredit is required when photoLicense is CC_BY_SA
 */
export const driverInputSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    nationality: isoCountrySchema.optional(),
    dateOfBirth: z.coerce.date().optional(),
    cityOfBirth: z.string().max(120).optional(),
    countryOfBirth: isoCountrySchema.optional(),
    racingNumber: z.number().int().min(0).max(999).optional(),
    nickname: z.string().max(100).optional(),
    shortBio: z.string().max(5000).optional(),
    officialWebsite: z.string().url().optional(),
    instagram: z.string().max(120).optional(),
    twitter: z.string().max(120).optional(),
    status: driverStatusSchema.default('ACTIVE'),
    photoUrl: z
      .string()
      .url()
      .refine(isWikimediaUrl, {
        message:
          'photoUrl must be hosted on Wikimedia Commons (upload.wikimedia.org or commons.wikimedia.org)',
      })
      .optional(),
    photoLicense: photoLicenseSchema.optional(),
    photographerCredit: z.string().max(200).optional(),
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

export type DriverInput = z.infer<typeof driverInputSchema>;

export const driverListQuerySchema = paginationSchema.extend({
  series: z.string().min(1).optional(),
  nationality: isoCountrySchema.optional(),
  status: driverStatusSchema.optional(),
});

export type DriverListQuery = z.infer<typeof driverListQuerySchema>;

export const driverEntriesQuerySchema = z.object({
  series: z.string().min(1).optional(),
  season: z.coerce.number().int().min(1900).max(2100).optional(),
});

export type DriverEntriesQuery = z.infer<typeof driverEntriesQuerySchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Query must be at least 2 characters'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
