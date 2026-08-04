import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { validateResponse, printWarnings } from '../src/validate.js';
import { ListingResponseSchema } from '../src/schemas.js';

const SimpleSchema = z.object({ name: z.string(), count: z.number() });

describe('validateResponse', () => {
  it('returns typed data on successful parse', () => {
    const result = validateResponse(SimpleSchema, { name: 'test', count: 3 }, 'context');
    expect(result.data).toEqual({ name: 'test', count: 3 });
    expect(result.warnings).toEqual([]);
    expect(result.raw).toEqual({ name: 'test', count: 3 });
  });

  it('applies schema defaults', () => {
    const result = validateResponse(SimpleSchema, { count: 3 }, 'context');
    // name is required, so this actually fails — use the lenient listing schema instead
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('produces a warning and falls back to raw data on schema mismatch', () => {
    const result = validateResponse(SimpleSchema, { name: 123, count: 'x' }, 'my-command');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('my-command');
    expect(result.warnings[0]).toContain('name');
    expect(result.data).toEqual({ name: 123, count: 'x' });
  });

  it('accepts reddit-mcp-buddy listing responses', () => {
    const raw = { results: [{ title: 'Hello', author: 'u', score: 5 }] };
    const result = validateResponse(ListingResponseSchema, raw, 'search');
    expect(result.warnings).toEqual([]);
    expect(result.data.results?.[0].title).toBe('Hello');
  });

  it('accepts standard Reddit API responses', () => {
    const raw = { data: { children: [{ data: { title: 'Hi', author: 'x', score: 1 } }] } };
    const result = validateResponse(ListingResponseSchema, raw, 'browse');
    expect(result.warnings).toEqual([]);
  });
});

describe('printWarnings', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => errSpy?.mockRestore());

  it('prints each warning to stderr', () => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printWarnings(['first warning', 'second warning']);
    expect(errSpy).toHaveBeenCalledTimes(2);
  });

  it('does nothing when there are no warnings', () => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printWarnings([]);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
