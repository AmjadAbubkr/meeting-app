import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { getRenderableSections } from '../../services/reportSections';
import { exportPDF, exportDOCX, shareExportedFile } from '../../services/exporter';
import type { Language, ReportData } from '../../store/appStore';
import { theme } from './theme';

type Props = {
  meetingTitle: string;
  meetingDate: string;
  report: ReportData;
  summary: string[];
  currentMeetingId: number | null;
  currentLanguage: Language;
  onReset: () => void;
  onViewInHistory: () => void;
};

export function ResultsState({
  meetingTitle,
  meetingDate,
  report,
  summary,
  currentMeetingId,
  currentLanguage,
  onReset,
  onViewInHistory,
}: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (currentMeetingId === null) return;
    try {
      setExporting(true);
      const meetingForExport = {
        id: currentMeetingId,
        title: meetingTitle,
        date: meetingDate,
        reports: JSON.stringify({
          [currentLanguage]: { report, summary },
        }),
      };
      const path =
        format === 'pdf'
          ? await exportPDF(meetingForExport, currentLanguage)
          : await exportDOCX(meetingForExport, currentLanguage);
      await shareExportedFile(path, format, meetingTitle);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export file.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{meetingTitle}</Text>
      <Text style={styles.date}>{meetingDate}</Text>

      {getRenderableSections(report, summary).map(({ section, value }) => (
        <View key={section.key} style={styles.section}>
          <Text
            style={
              section.key === 'summary' ? styles.sectionTitle : styles.sectionSubtitle
            }
          >
            {section.title}
          </Text>
          {section.kind === 'bullets'
            ? (value as string[]).map((v) => (
                <Text key={`${section.key}-${v}`} style={styles.bulletText}>
                  {'\u2022'} {v}
                </Text>
              ))
            : <Text style={styles.bodyText}>{value as string}</Text>}
        </View>
      ))}

      <PrimaryButton label="New Meeting" onPress={onReset} />

      {currentMeetingId !== null && (
        <PrimaryButton
          label="View in History"
          onPress={onViewInHistory}
          variant="ghost"
        />
      )}

      {exporting ? (
        <View style={styles.exportingContainer}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.exportingText}>Exporting...</Text>
        </View>
      ) : (
        <>
          <PrimaryButton
            label="Export as PDF"
            onPress={() => handleExport('pdf')}
            variant="ghost"
          />
          <PrimaryButton
            label="Export as DOCX"
            onPress={() => handleExport('docx')}
            variant="ghost"
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 12,
  },
  title: {
    color: theme.textMuted,
    fontSize: 24,
    fontWeight: '700',
  },
  date: {
    color: theme.textMuted,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    color: theme.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  bulletText: {
    color: theme.text,
    fontSize: 14,
  },
  bodyText: {
    color: theme.text,
    fontSize: 14,
  },
  exportingContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  exportingText: {
    color: theme.textMuted,
    fontSize: 14,
  },
});
