import RNFS from 'react-native-fs';
import { Share, PermissionsAndroid, Platform } from 'react-native';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import type { MeetingRecord } from '../db/database';
import { getReportForLanguage } from '../db/database';
import { getRenderableSections } from './reportSections';
import type { ReportData } from '../store/appStore';

/**
 * Sanitize a string for use in filenames.
 * Removes path traversal characters and replaces non-alphanumeric chars with dashes.
 * Truncates to 50 characters max.
 */
async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'Meeting App needs storage access to save exported files.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

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
      new TextRun({ text: '\u2022 ', bold: true }),
      new TextRun({ text }),
    ],
    spacing: { after: 60 },
  });
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

  const granted = await requestStoragePermission();
  if (!granted) {
    throw new Error('Storage permission denied — cannot export PDF.');
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
      directory: 'Documents' as const,
    };

    const result = await RNHTMLtoPDF.convert(options);

    if (!result.filePath) {
      throw new Error('PDF generator returned no file path.');
    }

    return result.filePath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate PDF';
    throw new Error(msg);
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

  const granted = await requestStoragePermission();
  if (!granted) {
    throw new Error('Storage permission denied — cannot export DOCX.');
  }

  const { report, summary } = reportData;

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: meeting.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
    }),
  );

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

  const doc = new Document({
    sections: [{ children }],
  });

  const safeTitle = sanitizeFilename(meeting.title);
  const safeDate = sanitizeFilename(meeting.date);

  const outputPath = `${RNFS.DocumentDirectoryPath}/Meeting-${safeTitle}-${safeDate}.docx`;

  try {
    const buffer = await Packer.toBuffer(doc);
    let base64: string;

    if (typeof buffer === 'string') {
      base64 = buffer;
    } else if (buffer instanceof Uint8Array || Array.isArray(buffer)) {
      let binary = '';
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = btoa(binary);
    } else if (typeof (buffer as any).toString === 'function') {
      base64 = (buffer as any).toString('base64');
    } else {
      throw new Error('Unexpected buffer type from Packer.toBuffer');
    }

    await RNFS.writeFile(outputPath, base64, 'base64');
    return outputPath;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save DOCX file';
    throw new Error(msg);
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
