import { z } from 'zod';

/**
 * ISO 3166-1 alpha-2 country codes used for validating nationality / country
 * fields. Kept as a focused, motorsport-relevant subset that is easy to extend.
 */
export const ISO_3166_ALPHA2 = [
  'AD',
  'AE',
  'AR',
  'AT',
  'AU',
  'BE',
  'BR',
  'CA',
  'CH',
  'CL',
  'CN',
  'CO',
  'CZ',
  'DE',
  'DK',
  'DZ',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'HK',
  'HU',
  'ID',
  'IE',
  'IN',
  'IT',
  'JP',
  'KR',
  'LU',
  'MC',
  'MX',
  'MY',
  'NL',
  'NO',
  'NZ',
  'PL',
  'PT',
  'QA',
  'RU',
  'SA',
  'SE',
  'SG',
  'TH',
  'TR',
  'UA',
  'US',
  'ZA',
  // additional motorsport nationalities
  'AO',
  'BG',
  'CR',
  'HR',
  'IL',
  'IS',
  'LT',
  'LV',
  'OM',
  'PE',
  'PH',
  'RO',
  'RS',
  'SI',
  'SK',
  'UY',
  'VE',
] as const;

const isoCodeSet = new Set<string>(ISO_3166_ALPHA2);

export function isValidIsoCountry(code: string): boolean {
  return isoCodeSet.has(code.toUpperCase());
}

export const isoCountrySchema = z
  .string()
  .length(2)
  .transform((value) => value.toUpperCase())
  .refine((value) => isValidIsoCountry(value), {
    message: 'Must be a valid ISO 3166-1 alpha-2 country code',
  });

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color, e.g. "#DC0000"');

/**
 * Optional hex colour: accepts a valid hex, an empty string, or an omitted
 * field — all of which normalise to `undefined` (stored as NULL). Useful for
 * teams whose colours are not known yet.
 */
export const optionalHexColorSchema = z
  .union([hexColorSchema, z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Wikimedia Commons is the only accepted source for hosted driver photos.
 */
export function isWikimediaUrl(url: string): boolean {
  return (
    url.startsWith('https://upload.wikimedia.org') ||
    url.startsWith('https://commons.wikimedia.org')
  );
}

/**
 * Generate a URL-safe slug from one or more name parts: lowercase, ASCII,
 * hyphen-separated.
 */
export function slugify(...parts: string[]): string {
  return parts
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A cuid() starts with "c" and is a long lowercase alphanumeric string. */
export function looksLikeCuid(value: string): boolean {
  return /^c[a-z0-9]{20,}$/.test(value);
}
