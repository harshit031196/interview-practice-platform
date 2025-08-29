import { describe, it, expect } from 'vitest'
import { formatDuration, formatCurrency, getReadinessColor } from '@/lib/utils'

describe('Utils', () => {
  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(30)).toBe('30s')
      expect(formatDuration(90)).toBe('1m 30s')
      expect(formatDuration(3600)).toBe('1h 0m')
      expect(formatDuration(3665)).toBe('1h 1m')
    })

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0s')
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toBe('$10.00')
      expect(formatCurrency(2550)).toBe('$25.50')
      expect(formatCurrency(0)).toBe('$0.00')
    })
  })

  describe('getReadinessColor', () => {
    it('should return correct colors for readiness scores', () => {
      expect(getReadinessColor(30)).toBe('text-red-600')
      expect(getReadinessColor(50)).toBe('text-red-600')
      expect(getReadinessColor(60)).toBe('text-yellow-600')
      expect(getReadinessColor(75)).toBe('text-yellow-600')
      expect(getReadinessColor(85)).toBe('text-green-600')
      expect(getReadinessColor(95)).toBe('text-green-600')
    })

    it('should handle edge cases', () => {
      expect(getReadinessColor(0)).toBe('text-red-600')
      expect(getReadinessColor(100)).toBe('text-green-600')
    })
  })
})
