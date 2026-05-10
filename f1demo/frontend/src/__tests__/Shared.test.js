import { describe, it, expect } from 'vitest';
import { formatDate, formatDateFull, pad, eventName } from '../components/Shared';

describe('Shared utility functions', () => {
  describe('pad', () => {
    it('pads single digit numbers with leading zero', () => {
      expect(pad(5)).toBe('05');
      expect(pad(0)).toBe('00');
      expect(pad(9)).toBe('09');
    });

    it('returns two-digit numbers unchanged', () => {
      expect(pad(12)).toBe('12');
      expect(pad(99)).toBe('99');
    });

    it('handles floats by truncating', () => {
      expect(pad(5.7)).toMatch(/^0/);
    });
  });

  describe('formatDate', () => {
    it('formats ISO date strings to readable format', () => {
      const result = formatDate('2024-03-01T00:00:00Z');
      expect(result).toContain('2024');
    });

    it('handles null gracefully', () => {
      const result = formatDate(null);
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDateFull', () => {
    it('formats dates with month and day names', () => {
      const result = formatDateFull('2024-03-01');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('eventName', () => {
    it('extracts event name from location object', () => {
      const location = { OfficialEventName: 'Monaco Grand Prix' };
      const result = eventName(location);
      expect(result).toContain('Monaco');
    });

    it('falls back to EventName field', () => {
      const location = { EventName: 'Austrian Grand Prix' };
      const result = eventName(location);
      expect(result).toContain('Austria');
    });
  });
});
