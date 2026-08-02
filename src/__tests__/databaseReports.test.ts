import { describe, expect, it } from '@jest/globals';
import { parseReports } from '../db/database';

describe('parseReports', () => {
  const meeting = (reports: unknown) => ({
    id: 1,
    title: 'Test meeting',
    date: '2026-08-02',
    reports: JSON.stringify(reports),
  });

  it('parses the current language-keyed report shape', () => {
    const result = parseReports(
      meeting({ EN: { report: { overview: 'Overview' }, summary: ['Summary'] } }),
    );

    expect(result.EN).toEqual({
      report: { overview: 'Overview' },
      summary: ['Summary'],
    });
  });

  it('keeps older direct report records renderable', () => {
    const result = parseReports(
      meeting({ report: { overview: 'Legacy overview' }, summary: ['Legacy summary'] }),
    );

    expect(result.EN).toEqual({
      report: { overview: 'Legacy overview' },
      summary: ['Legacy summary'],
    });
  });
});
