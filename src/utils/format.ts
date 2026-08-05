import chalk from 'chalk';
import { writeFileSync } from 'node:fs';

export type OutputFormat = 'table' | 'json' | 'csv' | 'compact-json' | 'raw';

export interface FormatOptions {
  format?: OutputFormat;
  output?: string;
}

export function formatOutput(data: unknown, options: FormatOptions, meta?: Record<string, unknown>): void {
  const formatted = formatString(data, options.format);

  if (options.output) {
    writeFileSync(options.output, formatted + '\n', 'utf-8');
    log(`Written to ${options.output}`);
  } else {
    console.log(formatted);
  }

  if (meta) {
    const metaLine = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(' | ');
    log(metaLine);
  }
}

export function formatString(data: unknown, format?: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'compact-json':
      return JSON.stringify(data);
    case 'raw':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return toCsv(data);
    case 'table':
    default:
      return toTable(data);
  }
}

export function log(message: string): void {
  console.error(chalk.dim(message));
}

export function warn(message: string): void {
  console.error(chalk.yellow(`Warning: ${message}`));
}

export function debug(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(chalk.dim(`[debug] ${message}`));
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
    const maxData = Math.max(...rows.map(r => formatCellValue(r[k]).length));
    return Math.max(k.length, maxData);
  });

  const header = keys.map((k, i) => k.padEnd(colWidths[i])).join('  ');
  const separator = colWidths.map(w => '─'.repeat(w)).join('──');
  const body = rows.map(row =>
    keys.map((k, i) => formatCellValue(row[k]).padEnd(colWidths[i])).join('  ')
  );

  return [chalk.bold(header), chalk.dim(separator), ...body].join('\n');
}

/**
 * Format a cell value for table display.
 * Handles objects, arrays, and primitives properly.
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    // For objects like coordinates, show key info
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    if (keys.length <= 3) {
      return keys.map(k => `${k}=${obj[k]}`).join(', ');
    }
    return `{${keys.length} fields}`;
  }
  return String(value);
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
