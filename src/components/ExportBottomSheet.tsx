import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Modal from 'react-native-modal';
import { PrimaryButton } from './PrimaryButton';
import { exportPDF, exportDOCX, shareExportedFile, shareText } from '../services/exporter';
import type { MeetingRecord } from '../db/database';

type Props = {
  visible: boolean;
  onClose: () => void;
  meeting: MeetingRecord | null;
  language?: 'EN' | 'FR';
};

export function ExportBottomSheet({ visible, onClose, meeting, language = 'EN' }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | null>(null);

  const handleExportPDF = async () => {
    if (!meeting) return;
    try {
      setExporting(true);
      setExportFormat('pdf');
      const path = await exportPDF(meeting, language);
      await shareExportedFile(path, 'pdf', meeting.title);
      onClose();
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to generate PDF.');
    } finally {
      setExporting(false);
      setExportFormat(null);
    }
  };

  const handleExportDOCX = async () => {
    if (!meeting) return;
    try {
      setExporting(true);
      setExportFormat('docx');
      const path = await exportDOCX(meeting, language);
      await shareExportedFile(path, 'docx', meeting.title);
      onClose();
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to generate DOCX.');
    } finally {
      setExporting(false);
      setExportFormat(null);
    }
  };

  const handleShareText = async () => {
    if (!meeting) return;
    try {
      await shareText(meeting, language);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share text.');
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
      backdropColor="rgba(0,0,0,0.7)"
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Export</Text>

        {exporting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#d4a574" />
            <Text style={styles.loadingText}>
              Exporting as {exportFormat === 'pdf' ? 'PDF' : 'DOCX'}...
            </Text>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <PrimaryButton
              label="Export as PDF"
              onPress={handleExportPDF}
              disabled={exporting}
            />

            <PrimaryButton
              label="Export as DOCX"
              onPress={handleExportDOCX}
              disabled={exporting}
            />

            <PrimaryButton
              label="Share as Text"
              onPress={handleShareText}
              variant="ghost"
              disabled={exporting}
            />
          </View>
        )}

        <Pressable onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  title: {
    color: '#f5f0eb',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  buttonsContainer: {
    gap: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: {
    color: '#8a7e72',
    fontSize: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 12,
  },
  cancelText: {
    color: '#8a7e72',
    fontSize: 16,
  },
});
