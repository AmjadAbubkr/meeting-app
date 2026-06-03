import RNFS from 'react-native-fs';
import { Share, Alert } from 'react-native';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import type { MeetingRecord } from '../db/database';
import type { ReportData } from '../store/appStore';

/** Parsed reports structure from the JSON column */
type ParsedReports = {
  EN?: { report: ReportData; summary: string[] };
  FR?: { report: ReportData; summary: string[] };
};

/**
 * Parse the reports JSON string from a MeetingRecord.
 * Returns an object keyed by language code.
 */
function parseReports(meeting: MeetingRecord): ParsedReports {
  if (!meeting.reports) return {};
  try {
    return JSON.parse(meeting.reports) as ParsedReports;
  } catch {
    return {};
  }
}

/**
 * Get report data for a specific language, falling back to EN, then any available.
 */
function getReportForLanguage(
  meeting: MeetingRecord,
  language: 'EN' | 'FR',
): { report: ReportData; summary: string[] } | null {
  const parsed = parseReports(meeting);
  const langData = parsed[language];
  if (langData) return langData;
  // Fallback to EN
  if (parsed.EN) return parsed.EN;
  // Fallback to FR
  if (parsed.FR) return parsed.FR;
  return null;
}

/**
 * Sanitize a string for use in filenames.
 * Removes path traversal characters and replaces non-alphanumeric chars with dashes.
 * Truncates to 50 characters max.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with dash
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, '') // Trim leading/trailing dashes
    .substring(0, 50);
}

/**
 * Build an HTML document from meeting report data for PDF conversion.
 */
function buildReportHTML(
  title: string,
  date: string,
  report: ReportData,
  summary: string[],
): string {
  const summarySection = summary.length > 0
    ? `<h2>Summary</h2><ul>${summary.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
    : '';

  const overviewSection = report.overview
    ? `<h2>Overview</h2><p>${escapeHtml(report.overview)}</p>`
    : '';

  const keyDiscussionPointsSection =
    report.keyDiscussionPoints && report.keyDiscussionPoints.length > 0
      ? `<h2>Key Discussion Points</h2><ul>${report.keyDiscussionPoints
          .map((p) => `<li>${escapeHtml(p)}</li>`)
          .join('')}</ul>`
      : '';

  const actionItemsSection =
    report.actionItems && report.actionItems.length > 0
      ? `<h2>Action Items</h2><ul>${report.actionItems
          .map((a) => `<li>${escapeHtml(a)}</li>`)
          .join('')}</ul>`
      : '';

  const decisionsMadeSection =
    report.decisionsMade && report.decisionsMade.length > 0
      ? `<h2>Decisions Made</h2><ul>${report.decisionsMade
          .map((d) => `<li>${escapeHtml(d)}</li>`)
          .join('')}</ul>`
      : '';

  const openQuestionsSection =
    report.openQuestions && report.openQuestions.length > 0
      ? `<h2>Open Questions</h2><ul>${report.openQuestions
          .map((q) => `<li>${escapeHtml(q)}</li>`)
          .join('')}</ul>`
      : '';

  return `<html>
<head><style>
body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
h1 { color: #0b1220; border-bottom: 2px solid #d97706; padding-bottom: 8px; }
h2 { color: #d97706; margin-top: 24px; }
.meta { color: #64748b; margin-bottom: 24px; }
ul { padding-left: 20px; }
li { margin-bottom: 6px; }
p { line-height: 1.6; }
</style></head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">${escapeHtml(date)}</div>
${summarySection}
${overviewSection}
${keyDiscussionPointsSection}
${actionItemsSection}
${decisionsMadeSection}
${openQuestionsSection}
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent injection in the generated document.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build a plain text version of the meeting report for sharing.
 */
function buildReportText(
  title: string,
  date: string,
  report: ReportData,
  summary: string[],
): string {
  const lines: string[] = [];

  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push(date);
  lines.push('');

  if (summary.length > 0) {
    lines.push('SUMMARY');
    lines.push('-'.repeat(7));
    summary.forEach((s) => lines.push(`• ${s}`));
    lines.push('');
  }

  if (report.overview) {
    lines.push('OVERVIEW');
    lines.push('-'.repeat(8));
    lines.push(report.overview);
    lines.push('');
  }

  if (report.keyDiscussionPoints && report.keyDiscussionPoints.length > 0) {
    lines.push('KEY DISCUSSION POINTS');
    lines.push('-'.repeat(20));
    report.keyDiscussionPoints.forEach((p) => lines.push(`• ${p}`));
    lines.push('');
  }

  if (report.actionItems && report.actionItems.length > 0) {
    lines.push('ACTION ITEMS');
    lines.push('-'.repeat(12));
    report.actionItems.forEach((a) => lines.push(`• ${a}`));
    lines.push('');
  }

  if (report.decisionsMade && report.decisionsMade.length > 0) {
    lines.push('DECISIONS MADE');
    lines.push('-'.repeat(14));
    report.decisionsMade.forEach((d) => lines.push(`• ${d}`));
    lines.push('');
  }

  if (report.openQuestions && report.openQuestions.length > 0) {
    lines.push('OPEN QUESTIONS');
    lines.push('-'.repeat(14));
    report.openQuestions.forEach((q) => lines.push(`• ${q}`));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export a meeting report as a PDF file.
 *
 * Generates a formatted HTML document and converts it to PDF using react-native-html-to-pdf.
 * The file is saved to the device Downloads directory (Android 10+ scoped storage).
 *
 * @param meeting - The meeting record to export
 * @param language - The language variant to export ('EN' or 'FR')
 * @returns The file path of the generated PDF
 * @throws Error if no report data exists, or if PDF generation fails
 */
export async function exportPDF(
  meeting: MeetingRecord,
  language: 'EN' | 'FR' = 'EN',
): Promise<string> {
  const reportData = getReportForLanguage(meeting, language);
  if (!reportData) {
    throw new Error('No report data to export');
  }

  const { report, summary } = reportData;
  const htmlContent = buildReportHTML(meeting.title, meeting.date, report, summary);

  const safeTitle = sanitizeFilename(meeting.title);
  const safeDate = sanitizeFilename(meeting.date);
  const fileName = `Meeting-${safeTitle}-${safeDate}`;

  try {
    const options = {
      html: htmlContent,
      fileName,
      directory: 'Downloads' as const, // Android 10+ scoped storage
    };

    const result = await RNHTMLtoPDF.convert(options);
    return result.filePath;
  } catch (err) {
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Export a meeting report as a DOCX file.
 *
 * Uses the `docx` library to build a Word document with structured content.
 * The file is saved to the device Downloads directory using react-native-fs.
 *
 * @param meeting - The meeting record to export
 * @param language - The language variant to export ('EN' or 'FR')
 * @returns The file path of the generated DOCX
 * @throws Error if no report data exists, or if file writing fails
 */
export async function exportDOCX(
  meeting: MeetingRecord,
  language: 'EN' | 'FR' = 'EN',
): Promise<string> {
  const reportData = getReportForLanguage(meeting, language);
  if (!reportData) {
    throw new Error('No report data to export');
  }

  const { report, summary } = reportData;

  // Build document paragraphs
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: meeting.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
    }),
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: meeting.date,
          color: '64748b',
          size: 22,
        }),
      ],
      spacing: { after: 300 },
    }),
  );

  // Summary
  if (summary.length > 0) {
    children.push(
      new Paragraph({
        text: 'Summary',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    summary.forEach((bullet) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            new TextRun({ text: bullet }),
          ],
          spacing: { after: 60 },
        }),
      );
    });
  }

  // Overview
  if (report.overview) {
    children.push(
      new Paragraph({
        text: 'Overview',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    children.push(
      new Paragraph({
        text: report.overview,
        spacing: { after: 120 },
      }),
    );
  }

  // Key Discussion Points
  if (report.keyDiscussionPoints && report.keyDiscussionPoints.length > 0) {
    children.push(
      new Paragraph({
        text: 'Key Discussion Points',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    report.keyDiscussionPoints.forEach((point) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            new TextRun({ text: point }),
          ],
          spacing: { after: 60 },
        }),
      );
    });
  }

  // Action Items
  if (report.actionItems && report.actionItems.length > 0) {
    children.push(
      new Paragraph({
        text: 'Action Items',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    report.actionItems.forEach((item) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            new TextRun({ text: item }),
          ],
          spacing: { after: 60 },
        }),
      );
    });
  }

  // Decisions Made
  if (report.decisionsMade && report.decisionsMade.length > 0) {
    children.push(
      new Paragraph({
        text: 'Decisions Made',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    report.decisionsMade.forEach((decision) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            new TextRun({ text: decision }),
          ],
          spacing: { after: 60 },
        }),
      );
    });
  }

  // Open Questions
  if (report.openQuestions && report.openQuestions.length > 0) {
    children.push(
      new Paragraph({
        text: 'Open Questions',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    report.openQuestions.forEach((question) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            new TextRun({ text: question }),
          ],
          spacing: { after: 60 },
        }),
      );
    });
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const safeTitle = sanitizeFilename(meeting.title);
  const safeDate = sanitizeFilename(meeting.date);
  const filePath = `${RNFS.DownloadDirectoryPath}/Meeting-${safeTitle}-${safeDate}.docx`;

  try {
    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString('base64');
    await RNFS.writeFile(filePath, base64, 'base64');
    return filePath;
  } catch (err) {
    throw new Error('Failed to save file');
  }
}

/**
 * Share a meeting report as plain text using the system share sheet.
 *
 * @param meeting - The meeting record to share
 * @param language - The language variant to share ('EN' or 'FR')
 * @throws Error if no report data exists
 */
export async function shareText(
  meeting: MeetingRecord,
  language: 'EN' | 'FR' = 'EN',
): Promise<void> {
  const reportData = getReportForLanguage(meeting, language);
  if (!reportData) {
    throw new Error('No report data to export');
  }

  const { report, summary } = reportData;
  const textContent = buildReportText(meeting.title, meeting.date, report, summary);

  await Share.share({
    message: textContent,
    title: meeting.title,
  });
}
