import { describe, it, expect } from '@jest/globals';
import { REPORT_SECTIONS, getRenderableSections } from '../services/reportSections';
import type { ReportData } from '../store/appStore';

describe('reportSections', () => {
  it('REPORT_SECTIONS has 6 entries', () => {
    expect(REPORT_SECTIONS).toHaveLength(6);
  });

  it('REPORT_SECTIONS keys match expected section names', () => {
    const keys = REPORT_SECTIONS.map((s) => s.key);
    expect(keys).toEqual(['summary', 'overview', 'keyDiscussionPoints', 'actionItems', 'decisionsMade', 'openQuestions']);
  });

  it('each section has key, title, and kind', () => {
    for (const section of REPORT_SECTIONS) {
      expect(section.key).toBeDefined();
      expect(section.title).toBeDefined();
      expect(['bullets', 'paragraph']).toContain(section.kind);
    }
  });

  it('getRenderableSections returns empty array for empty report', () => {
    const result = getRenderableSections({} as ReportData, []);
    expect(result).toEqual([]);
  });

  it('getRenderableSections includes summary when provided', () => {
    const result = getRenderableSections({} as ReportData, ['Point 1', 'Point 2']);
    expect(result).toHaveLength(1);
    expect(result[0].section.key).toBe('summary');
    expect(result[0].value).toEqual(['Point 1', 'Point 2']);
  });

  it('getRenderableSections includes overview when provided', () => {
    const result = getRenderableSections({ overview: 'Test overview' } as ReportData, []);
    expect(result).toHaveLength(1);
    expect(result[0].section.key).toBe('overview');
    expect(result[0].value).toBe('Test overview');
  });

  it('getRenderableSections includes actionItems when provided', () => {
    const result = getRenderableSections({ actionItems: ['Do X', 'Do Y'] } as ReportData, []);
    expect(result).toHaveLength(1);
    expect(result[0].section.key).toBe('actionItems');
    expect(result[0].value).toEqual(['Do X', 'Do Y']);
  });

  it('getRenderableSections returns multiple sections for full report', () => {
    const report: ReportData = {
      overview: 'Overview text',
      keyDiscussionPoints: ['Point A'],
      actionItems: ['Action B'],
      decisionsMade: ['Decision C'],
      openQuestions: ['Question D'],
    };
    const result = getRenderableSections(report, ['Summary item']);
    expect(result.length).toBe(6);
  });
});
