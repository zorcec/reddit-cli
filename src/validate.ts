import type { z } from 'zod';
import chalk from 'chalk';

export interface ValidationResult<T> {
  data: T;
  warnings: string[];
  raw: unknown;
}

export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  raw: unknown,
  context: string,
): ValidationResult<T> {
  const warnings: string[] = [];
  const result = schema.safeParse(raw);

  if (result.success) {
    return { data: result.data, warnings, raw };
  }

  // Schema mismatch — extract details for the agent
  const issues = result.error.issues.map(i => {
    const path = i.path.length > 0 ? i.path.join('.') : '(root)';
    return `  ${path}: ${i.message}`;
  });

  warnings.push(
    `API response shape changed for "${context}". ` +
    `This may indicate reddit-mcp-buddy updated or Reddit changed their API.\n` +
    issues.join('\n')
  );

  // Return raw data cast to T — partial/unsafe
  return { data: raw as T, warnings, raw };
}

export function printWarnings(warnings: string[]): void {
  for (const w of warnings) {
    console.error(chalk.yellow(`\n  Schema warning: ${w}\n`));
  }
}
