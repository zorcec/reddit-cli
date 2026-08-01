import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatOutput, formatString, info, warn, error } from '../src/utils/format.js';

describe('format', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatString', () => {
    it('formats as JSON', () => {
      const data = { foo: 'bar' };
      const result = formatString(data, 'json');
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it('formats as CSV', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const result = formatString(data, 'csv');
      expect(result).toContain('name,age');
      expect(result).toContain('Alice,30');
      expect(result).toContain('Bob,25');
    });

    it('formats as table', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const result = formatString(data, 'table');
      expect(result).toContain('name');
      expect(result).toContain('age');
    });

    it('handles empty array', () => {
      const result = formatString([], 'table');
      expect(result).toContain('No results');
    });
  });

  describe('formatOutput', () => {
    it('outputs to stdout by default', () => {
      const data = { foo: 'bar' };
      formatOutput(data, { format: 'json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it('outputs metadata to stderr', () => {
      const data = { foo: 'bar' };
      const meta = { count: 10, source: 'cache' };

      formatOutput(data, { format: 'json' }, meta);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('outputs to stderr', () => {
      info('Test message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('outputs warning to stderr', () => {
      warn('Test warning');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('outputs error to stderr', () => {
      error('Test error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
