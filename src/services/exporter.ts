import RNFS from 'react-native-fs';
import { Share } from 'react-native';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as HTMLToPDFModule from 'react-native-html-to-pdf';
import NativeShare from 'react-native-share';
import type { MeetingRecord } from '../db/database';
import { getReportForLanguage } from '../db/database';
import { getRenderableSections } from './reportSections';
import type { ReportData } from '../store/appStore';

type ExportFormat = 'pdf' | 'docx';

type PDFResult = {
  filePath: string;
};

type GeneratePDF = (options: {
  html: string;
  fileName: string;
  directory?: string;
}) => Promise<PDFResult>;

// react-native-html-to-pdf v1.3 exports generatePDF by name at runtime.
// Its bundled declaration in this project only declares a default export.
const { generatePDF } = HTMLToPDFModule as unknown as {
  generatePDF: GeneratePDF;
};

function sanitizeFilename(name: string): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  return sanitized || 'meeting';
}

function buildReportHTML(
  title: string,
  date: string,
  report: ReportData,
  summary: string[],
): string {
  const sections = getRenderableSections(report, summary)
    .map(({ section, value }) => {
      const body =
        section.kind === 'bullets'
          ? `<ul>${(value as string[]).map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`
          : `<p>${escapeHtml(value as string)}</p>`;
      return `<h2>${section.title}</h2>${body}`;
    })
    .join('');

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
${sections}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

  for (const { section, value } of getRenderableSections(report, summary)) {
    const header = section.title.toUpperCase();
    lines.push(header);
    lines.push('-'.repeat(header.length));
    if (section.kind === 'bullets') {
      (value as string[]).forEach((v) => lines.push(`• ${v}`));
    } else {
      lines.push(value as string);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: '• ', bold: true }),
      new TextRun({ text }),
    ],
    spacing: { after: 60 },
  });
}

export async function exportPDF(
  meeting: MeetingRecord,
  language: 'EN' | 'FR' = 'EN',
): Promise<string> {
  const reportData = getReportForLanguage(meeting, language);
  if (!reportData) {
    throw new Error('No report data to export');
  }

  if (typeof generatePDF !== 'function') {
    throw new Error('PDF export module is unavailable. Rebuild the Android app.');
  }

  const { report, summary } = reportData;
  const htmlContent = buildReportHTML(meeting.title, meeting.date, report, summary);
  const fileName = `Meeting-${sanitizeFilename(meeting.title)}-${sanitizeFilename(meeting.date)}`;

  const result = await generatePDF({
    html: htmlContent,
    fileName,
  });

  if (!result.filePath) {
    throw new Error('PDF generator returned no file path.');
  }

  return result.filePath;
}

export async function exportDOCX(
  meeting: MeetingRecord,
  language: 'EN' | 'FR' = 'EN',
): Promise<string> {
  const reportData = getReportForLanguage(meeting, language);
  if (!reportData) {
    throw new Error('No report data to export');
  }

  const { report, summary } = reportData;
  const children: Paragraph[] = [
    new Paragraph({
      text: meeting.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
    }),
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
  ];

  for (const { section, value } of getRenderableSections(report, summary)) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );

    if (section.kind === 'bullets') {
      (value as string[]).forEach((v) => children.push(bulletParagraph(v)));
    } else {
      children.push(
        new Paragraph({
          text: value as string,
          spacing: { after: 120 },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const outputPath = `${RNFS.CachesDirectoryPath}/Meeting-${sanitizeFilename(meeting.title)}-${sanitizeFilename(meeting.date)}.docx`;

  const base64 = await Packer.toBase64String(doc);
  if (!base64) {
    throw new Error('DOCX generator returned empty content.');
  }

  await RNFS.writeFile(outputPath, base64, 'base64');
  return outputPath;
}

export async function shareExportedFile(
  path: string,
  format: ExportFormat,
  title: string,
): Promise<void> {
  const exists = await RNFS.exists(path);
  if (!exists) {
    throw new Error('The exported file could not be found for sharing.');
  }

  await NativeShare.open({
    url: `file://${path}`,
    type:
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title,
    failOnCancel: false,
  });
}

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
