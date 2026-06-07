import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { deleteMeeting, getMeeting, updateMeeting, MeetingRecord, parseReports } from '../db/database';
import { generateReport } from '../services/generator';
import { getRenderableSections } from '../services/reportSections';
import { AudioPlayer } from '../components/AudioPlayer';
import { ExportBottomSheet } from '../components/ExportBottomSheet';
import type { Language } from '../store/appStore';

type Tab = 'report' | 'transcript' | 'audio';

export function MeetingDetailScreen({ navigation, route }: any) {
  const meetingId: number = route.params.meetingId;

  const [meeting, setMeeting] = useState<MeetingRecord | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [currentLang, setCurrentLang] = useState<Language>('EN');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  // Load meeting on focus
  useFocusEffect(
    useCallback(() => {
      getMeeting(meetingId).then((m) => {
        if (m) {
          setMeeting(m);
          setEditedTitle(m.title);
        }
      });
    }, [meetingId]),
  );

  // Determine if report exists for current language
  const parsedReports = meeting ? parseReports(meeting) : {};
  const currentReportData = parsedReports[currentLang];

  // Set initial language based on what's available
  useEffect(() => {
    if (meeting && !currentReportData) {
      if (parsedReports.EN) {
        setCurrentLang('EN');
      } else if (parsedReports.FR) {
        setCurrentLang('FR');
      }
    }
    // Only on initial load when meeting ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  const handleSaveTitle = async () => {
    if (!meeting || !editedTitle.trim()) return;
    setIsEditingTitle(false);
    const updated = await updateMeeting(meeting.id, { title: editedTitle.trim() });
    if (updated) {
      setMeeting(updated);
    }
  };

  const handleDelete = () => {
    if (!meeting) return;
    Alert.alert(
      'Delete Meeting',
      'Are you sure you want to delete this meeting? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMeeting(meeting.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleLanguageSwitch = (lang: Language) => {
    setCurrentLang(lang);
    setGenerateError(null);
  };

  const handleGenerateReport = async () => {
    if (!meeting || !meeting.rawTranscript) {
      setGenerateError('No transcript available to generate report.');
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateReport(meeting.rawTranscript, currentLang);

      // Build updated reports JSON: merge new language into existing reports
      let existingReports: Record<string, { report: any; summary: string[] }> = {};
      if (meeting.reports) {
        try {
          existingReports = JSON.parse(meeting.reports);
        } catch {
          // If existing is corrupt, start fresh
        }
      }
      existingReports[currentLang] = { report: result.report, summary: result.summary };
      const reportsJson = JSON.stringify(existingReports);

      const updated = await updateMeeting(meeting.id, {
        reports: reportsJson,
      });
      if (updated) {
        setMeeting(updated);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate report.';
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'report', label: 'Report' },
    { key: 'transcript', label: 'Transcript' },
    { key: 'audio', label: 'Audio' },
  ];

  const renderReportTab = () => {
    if (generating) {
      return (
        <View style={styles.centerContent}>
      <ActivityIndicator size="large" color="#d4a574" />
      <Text style={styles.generatingText}>
        Generating report in {currentLang === 'EN' ? 'English' : 'French'}...
      </Text>
        </View>
      );
    }

    if (generateError) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{generateError}</Text>
          <PrimaryButton label="Retry" onPress={handleGenerateReport} />
        </View>
      );
    }

    if (!currentReportData) {
      // No report for this language — offer to generate
      return (
        <View style={styles.centerContent}>
          <Text style={styles.noReportText}>
            No {currentLang === 'EN' ? 'English' : 'French'} report yet.
          </Text>
          <PrimaryButton
            label={`Generate ${currentLang === 'EN' ? 'English' : 'French'} Report`}
            onPress={handleGenerateReport}
          />
        </View>
      );
    }

    const { report, summary } = currentReportData;

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
      >
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
              ? (value as string[]).map((v, idx) => (
                  <Text key={idx} style={styles.bulletText}>
                    {'\u2022'} {v}
                  </Text>
                ))
              : <Text style={styles.bodyText}>{value as string}</Text>}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderTranscriptTab = () => {
    const transcriptText = meeting?.rawTranscript;

    return (
      <View style={styles.tabContent}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {transcriptText ? (
            <Text style={styles.transcriptText}>{transcriptText}</Text>
          ) : (
            <Text style={styles.noDataText}>No transcript available.</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderAudioTab = () => {
    return (
      <View style={styles.tabContent}>
        <AudioPlayer audioPath={meeting?.audioPath ?? null} />
      </View>
    );
  };

  return (
    <ScreenShell>
      <View style={styles.outerContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
      <Pressable
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
        style={styles.headerBtn}
      >
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>

          <View style={styles.titleContainer}>
            {isEditingTitle ? (
              <TextInput
                value={editedTitle}
                onChangeText={setEditedTitle}
                onBlur={handleSaveTitle}
                onSubmitEditing={handleSaveTitle}
                autoFocus
                style={styles.titleInput}
                returnKeyType="done"
              />
            ) : (
              <Pressable onPress={() => setIsEditingTitle(true)}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {meeting?.title || 'Meeting'}
                </Text>
              </Pressable>
            )}
          </View>

      <View style={styles.headerActions}>
        <Pressable onPress={() => setShowExport(true)} style={styles.headerBtn}>
          <Text style={styles.shareIcon}>{'\u2197'}</Text>
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.headerBtn}>
          <Text style={styles.deleteIcon}>{'\uD83D\uDDD1'}</Text>
        </Pressable>
      </View>
      </View>

      {/* Export bottom sheet */}
      <ExportBottomSheet
        visible={showExport}
        onClose={() => setShowExport(false)}
        meeting={meeting}
        language={currentLang}
      />

        {/* Language switcher (only in Report tab) */}
        {activeTab === 'report' && (
          <View style={styles.langRow}>
            <Pressable
              onPress={() => handleLanguageSwitch('EN')}
              style={[styles.langChip, currentLang === 'EN' && styles.langChipActive]}
            >
              <Text style={[styles.langText, currentLang === 'EN' && styles.langTextActive]}>
                EN
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleLanguageSwitch('FR')}
              style={[styles.langChip, currentLang === 'FR' && styles.langChipActive]}
            >
              <Text style={[styles.langText, currentLang === 'FR' && styles.langTextActive]}>
                FR
              </Text>
            </Pressable>
          </View>
        )}

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContentContainer}>
          {activeTab === 'report' && renderReportTab()}
          {activeTab === 'transcript' && renderTranscriptTab()}
          {activeTab === 'audio' && renderAudioTab()}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  backText: {
    color: '#d4a574',
    fontSize: 16,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  titleText: {
    color: '#f5f0eb',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleInput: {
    color: '#f5f0eb',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    borderBottomColor: '#d4a574',
    borderBottomWidth: 1,
    paddingVertical: 2,
    minWidth: 100,
  },
  deleteIcon: {
    fontSize: 20,
  },
  shareIcon: {
    color: '#d4a574',
    fontSize: 22,
    fontWeight: '700',
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  langChipActive: {
    backgroundColor: '#d4a574',
  },
  langText: {
    color: '#8a7e72',
    fontWeight: '700',
    fontSize: 14,
  },
  langTextActive: {
    color: '#0f0f0f',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomColor: 'rgba(212,165,116,0.15)',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#d4a574',
  },
  tabLabel: {
    color: '#8a7e72',
    fontWeight: '600',
    fontSize: 15,
  },
  tabLabelActive: {
    color: '#d4a574',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  generatingText: {
    color: '#8a7e72',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
  },
  noReportText: {
    color: '#8a7e72',
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    color: '#d4a574',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#d4a574',
    fontSize: 16,
    fontWeight: '600',
  },
  bulletText: {
    color: '#f5f0eb',
    fontSize: 14,
    lineHeight: 20,
  },
  bodyText: {
    color: '#f5f0eb',
    fontSize: 14,
    lineHeight: 20,
  },
  transcriptText: {
    color: '#f5f0eb',
    fontSize: 14,
    lineHeight: 22,
  },
  noDataText: {
    color: '#8a7e72',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
