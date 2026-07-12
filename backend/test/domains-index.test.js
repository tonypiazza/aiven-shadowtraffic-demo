import { describe, it, expect } from 'vitest';
import { getDomain } from '../src/domains/index.js';

describe('getDomain', () => {
  it('defaults to the github pack', () => {
    expect(getDomain().topic).toBe('github-events');
  });
  it('returns the github pack by name', () => {
    expect(getDomain('github').topic).toBe('github-events');
  });
  it('throws on unknown domain', () => {
    expect(() => getDomain('spaceships')).toThrow(/unknown domain/i);
  });
});
