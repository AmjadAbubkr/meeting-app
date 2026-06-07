import type { ReportData } from '../store/appStore';

export type SectionKind = 'bullets' | 'paragraph';

export type SectionKey =
  | 'summary'
  | 'overview'
  | 'keyDiscussionPoints'
  | 'actionItems'
  | 'decisionsMade'
  | 'openQuestions';

export type SectionDescriptor = {
  key: SectionKey;
  title: string;
  kind: SectionKind;
  read: (report: ReportData, summary: string[]) => string | string[] | null;
};

export const REPORT_SECTIONS: readonly SectionDescriptor[] = [
  {
    key: 'summary',
    title: 'Summary',
    kind: 'bullets',
    read: (_r, s) => (s.length > 0 ? s : null),
  },
  {
    key: 'overview',
    title: 'Overview',
    kind: 'paragraph',
    read: (r) => {
      const trimmed = r.overview?.trim();
      return trimmed ? trimmed : null;
    },
  },
  {
    key: 'keyDiscussionPoints',
    title: 'Key Discussion Points',
    kind: 'bullets',
    read: (r) => (r.keyDiscussionPoints?.length ? r.keyDiscussionPoints : null),
  },
  {
    key: 'actionItems',
    title: 'Action Items',
    kind: 'bullets',
    read: (r) => (r.actionItems?.length ? r.actionItems : null),
  },
  {
    key: 'decisionsMade',
    title: 'Decisions Made',
    kind: 'bullets',
    read: (r) => (r.decisionsMade?.length ? r.decisionsMade : null),
  },
  {
    key: 'openQuestions',
    title: 'Open Questions',
    kind: 'bullets',
    read: (r) => (r.openQuestions?.length ? r.openQuestions : null),
  },
] as const;

export type RenderableSection = {
  section: SectionDescriptor;
  value: string | string[];
};

export function getRenderableSections(
  report: ReportData,
  summary: string[],
): RenderableSection[] {
  const out: RenderableSection[] = [];
  for (const section of REPORT_SECTIONS) {
    const value = section.read(report, summary);
    if (value !== null) out.push({ section, value });
  }
  return out;
}
