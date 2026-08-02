import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-html-to-pdf', () => ({}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('../components/AudioPlayer', () => ({ AudioPlayer: () => null }));
jest.mock('../components/ExportBottomSheet', () => ({ ExportBottomSheet: () => null }));

import {
  getReportForDisplay,
  handleMeetingDetailBack,
} from '../screens/MeetingDetailScreen';

describe('meeting detail slice', () => {
  it('uses the saved report when the requested language is unavailable', () => {
    const meeting = {
      id: 1,
      title: 'Saved meeting',
      date: '2026-08-02',
      reports: JSON.stringify({
        EN: { report: { overview: 'Saved overview' }, summary: ['Saved summary'] },
      }),
    };

    expect(getReportForDisplay(meeting, 'FR')).toEqual({
      report: { overview: 'Saved overview' },
      summary: ['Saved summary'],
    });
  });

  it('returns to Main without depending on a stack pop', () => {
    const navigation = { navigate: jest.fn() };

    handleMeetingDetailBack(navigation);

    expect(navigation.navigate).toHaveBeenCalledWith('Main');
  });
});
