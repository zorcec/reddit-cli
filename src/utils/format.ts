import chalk from 'chalk';
import { writeFileSync } from 'node:fs';

export type OutputFormat = 'table' | 'json' | 'csv';

export interface FormatOptions {
  format?: OutputFormat;
  output?: string;
}

export function formatOutput(data: unknown, options: FormatOptions, meta?: Record<string, unknown>): void {
  const formatted = formatString(data, options.format);

  if (options.output) {
    writeFileSync(options.output, formatted + '\n', 'utf-8');
    console.error(chalk.dim(`Written to ${options.output}`));
  } else {
    console.log(formatted);
  }

  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      console.error(chalk.dim(`${key}: ${value}`));
    }
  }
}

export function formatString(data: unknown, format?: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return toCsv(data);
    case 'table':
    default:
      return toTable(data);
  }
}

function toTable(data: unknown): string {
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      return objectToTable(data as Record<string, unknown>);
    }
    return String(data);
  }
  if (data.length === 0) return chalk.dim('No results');
  if (typeof data[0] !== 'object' || data[0] === null) {
    return data.map(String).join('\n');
  }
  return arrayToTable(data as Record<string, unknown>[]);
}

function objectToTable(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      lines.push(`  ${chalk.cyan(key)}: ${formatValue(value)}`);
    }
  }
  return lines.join('\n');
}

function arrayToTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return chalk.dim('No results');

  const keys = Object.keys(rows[0]);
  const colWidths = keys.map(k => {
    const maxData = Math.max(...rows.map(r => String(r[k] ?? '').length));
    return Math.max(k.length, maxData);
  });

  const header = keys.map((k, i) => k.padEnd(colWidths[i])).join('  ');
  const separator = colWidths.map(w => '─'.repeat(w)).join('──');
  const body = rows.map(row =>
    keys.map((k, i) => String(row[k] ?? '').padEnd(colWidths[i])).join('  ')
  );

  return [chalk.bold(header), chalk.dim(separator), ...body].join('\n');
}

function toCsv(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  if (typeof data[0] !== 'object' || data[0] === null) {
    return data.map(v => escapeCsv(String(v))).join('\n');
  }
  const rows = data as Record<string, unknown>[];
  const keys = Object.keys(rows[0]);
  const header = keys.map(escapeCsv).join(',');
  const body = rows.map(row =>
    keys.map(k => escapeCsv(String(row[k] ?? ''))).join(',')
  );
  return [header, ...body].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value ?? '');
}

export function info(message: string): void {
  console.error(chalk.dim(message));
}

export function warn(message: string): void {
  console.error(chalk.yellow(`Warning: ${message}`));
}

export function error(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}
