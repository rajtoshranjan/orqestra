import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { formatTimestamp, formatRelativeTime } from './date';

describe('date utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatTimestamp', () => {
    it('should return "Never" for null', () => {
      expect(formatTimestamp(null)).toBe('Never');
    });

    it('should return "Never" for empty string', () => {
      expect(formatTimestamp('')).toBe('Never');
    });

    it('should format a valid date string', () => {
      // Mock Intl.DateTimeFormat to avoid flaky tests due to environment locale differences
      const spy = vi
        .spyOn(Intl, 'DateTimeFormat')
        .mockImplementation(function () {
          return {
            format: () => 'Mocked Date Format',
          };
        } as any);

      const result = formatTimestamp('2023-10-15T10:30:00Z');
      expect(result).toBe('Mocked Date Format');
      expect(spy).toHaveBeenCalledWith(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      spy.mockRestore();
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "Just now" for less than a minute ago', () => {
      const now = new Date('2023-10-15T10:30:00Z');
      vi.setSystemTime(now);

      // 30 seconds ago
      const target = new Date(now.getTime() - 30 * 1000).toISOString();
      expect(formatRelativeTime(target)).toBe('Just now');
    });

    it('should return "Xm ago" for minutes', () => {
      const now = new Date('2023-10-15T10:30:00Z');
      vi.setSystemTime(now);

      // 5 minutes ago
      const target = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(target)).toBe('5m ago');
    });

    it('should return "Xh ago" for hours', () => {
      const now = new Date('2023-10-15T10:30:00Z');
      vi.setSystemTime(now);

      // 2 hours ago
      const target = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(target)).toBe('2h ago');
    });

    it('should return "Xd ago" for days', () => {
      const now = new Date('2023-10-15T10:30:00Z');
      vi.setSystemTime(now);

      // 3 days ago
      const target = new Date(
        now.getTime() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(formatRelativeTime(target)).toBe('3d ago');
    });
  });
});
