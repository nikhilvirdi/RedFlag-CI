import { SEVERITY_ORDER, severityRank, compareSeverity, meetsOrExceeds } from './severityOrder';

describe('Task 5: severityOrder shared module', () => {
  it('defines the correct canonical severity ordering', () => {
    expect(SEVERITY_ORDER).toEqual(['high', 'warning', 'info']);
  });

  describe('severityRank', () => {
    it('assigns 0 to high, 1 to warning, 2 to info', () => {
      expect(severityRank('high')).toBe(0);
      expect(severityRank('warning')).toBe(1);
      expect(severityRank('info')).toBe(2);
    });
  });

  describe('compareSeverity', () => {
    it('sorts high before warning', () => {
      expect(compareSeverity('high', 'warning')).toBeLessThan(0);
    });

    it('sorts warning before info', () => {
      expect(compareSeverity('warning', 'info')).toBeLessThan(0);
    });

    it('sorts high before info', () => {
      expect(compareSeverity('high', 'info')).toBeLessThan(0);
    });

    it('returns 0 for equal severities', () => {
      expect(compareSeverity('warning', 'warning')).toBe(0);
    });
  });

  describe('meetsOrExceeds', () => {
    it('returns true when candidate is higher severity than threshold', () => {
      expect(meetsOrExceeds('high', 'warning')).toBe(true);
      expect(meetsOrExceeds('warning', 'info')).toBe(true);
      expect(meetsOrExceeds('high', 'info')).toBe(true);
    });

    it('returns true when candidate is equal to threshold', () => {
      expect(meetsOrExceeds('warning', 'warning')).toBe(true);
      expect(meetsOrExceeds('high', 'high')).toBe(true);
      expect(meetsOrExceeds('info', 'info')).toBe(true);
    });

    it('returns false when candidate is lower severity than threshold', () => {
      expect(meetsOrExceeds('warning', 'high')).toBe(false);
      expect(meetsOrExceeds('info', 'warning')).toBe(false);
      expect(meetsOrExceeds('info', 'high')).toBe(false);
    });
  });
});
