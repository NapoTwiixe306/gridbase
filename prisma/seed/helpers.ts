import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const DATA_DIR = join(__dirname, 'data');

/** Slug: lowercase, diacritics stripped, non-alphanumerics collapsed to hyphens. */
export function slugify(...parts: string[]): string {
  return parts
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface JsonGroup {
  /** Relative path of the source file, for error messages. */
  file: string;
  records: unknown[];
}

function readGroups(target: string): JsonGroup[] {
  if (!existsSync(target)) return [];

  // A single .json file or a directory tree of .json files.
  const isDir = !target.endsWith('.json');
  const files = isDir
    ? (readdirSync(target, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ rel: f, abs: join(target, f) }))
    : [{ rel: target.split('/').pop() as string, abs: target }];

  return files.map(({ rel, abs }) => {
    const parsed: unknown = JSON.parse(readFileSync(abs, 'utf-8'));
    return { file: rel, records: Array.isArray(parsed) ? parsed : [parsed] };
  });
}

/**
 * Load every record under a data file or directory and validate each one with
 * the given Zod schema. Throws a precise error (file + index) on the first
 * invalid record so contributors immediately know what to fix.
 */
export function loadAndValidate<T>(target: string, schema: z.ZodType<T>): T[] {
  const out: T[] = [];
  for (const group of readGroups(target)) {
    group.records.forEach((record, index) => {
      const result = schema.safeParse(record);
      if (!result.success) {
        const detail = result.error.issues
          .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
          .join('; ');
        throw new Error(`Invalid record in "${group.file}" [#${index}]: ${detail}`);
      }
      out.push(result.data);
    });
  }
  return out;
}

/** Resolve a value from a lookup map or throw a descriptive error. */
export function resolve<V>(map: Map<string, V>, key: string, kind: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Unknown ${kind}: "${key}" (not found in seeded data)`);
  }
  return value;
}

export function toDate(value?: string | null): Date | null {
  return value ? new Date(value) : null;
}

/** Split an array into chunks of `size` for batched database writes. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
