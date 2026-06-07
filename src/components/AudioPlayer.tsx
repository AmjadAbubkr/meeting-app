import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

// Module-level instance (same pattern as recorder.ts)
const audioRecorderPlayer = new AudioRecorderPlayer();

type Props = {
  audioPath: string | null;
};

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ audioPath }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've started so we can resume vs start
  const hasStartedRef = useRef(false);

  // Position listener cleanup ref
  const listenerAttachedRef = useRef(false);

  // Setup position listener
  useEffect(() => {
    if (!listenerAttachedRef.current) {
      audioRecorderPlayer.addPlayBackListener((e) => {
        setCurrentPosition(e.currentPosition);
        if (e.duration > 0) {
          setDuration(e.duration);
        }
        // When playback finishes, update state
        if (e.isFinished) {
          setIsPlaying(false);
          setCurrentPosition(0);
          hasStartedRef.current = false;
        }
      });
      listenerAttachedRef.current = true;
    }

    return () => {
      audioRecorderPlayer.removePlayBackListener();
      listenerAttachedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRecorderPlayer.stopPlayer().catch(() => {});
      audioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  const handlePlayPause = async () => {
    if (!audioPath) return;

    try {
      setError(null);

      if (!hasStartedRef.current) {
        // Start fresh
        setLoading(true);
        await audioRecorderPlayer.startPlayer(audioPath);
        await audioRecorderPlayer.setPlaybackSpeed(playbackSpeed);
        hasStartedRef.current = true;
        setIsPlaying(true);
        setLoading(false);
      } else if (isPlaying) {
        // Pause
        await audioRecorderPlayer.pausePlayer();
        setIsPlaying(false);
      } else {
        // Resume
        await audioRecorderPlayer.resumePlayer();
        setIsPlaying(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playback failed';
      setError(message);
      setIsPlaying(false);
      setLoading(false);
    }
  };

  const handleSeek = async (value: number) => {
    if (!hasStartedRef.current) return;
    try {
      await audioRecorderPlayer.seekToPlayer(value);
      setCurrentPosition(value);
    } catch {
      // Ignore seek errors
    }
  };

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    if (hasStartedRef.current) {
      try {
        await audioRecorderPlayer.setPlaybackSpeed(speed);
      } catch {
        // Ignore speed change errors
      }
    }
  };

  const speeds = [1, 1.5, 2];

  if (!audioPath) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.noAudioText}>No audio available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Play/Pause button */}
      <View style={styles.controlsRow}>
        {loading ? (
          <View style={styles.playBtn}>
            <ActivityIndicator size="small" color="#0f0f0f" />
          </View>
        ) : (
          <Pressable
            onPress={handlePlayPause}
            style={[styles.playBtn, isPlaying ? styles.playBtnActive : styles.playBtnPaused]}
          >
            <Text style={[styles.playBtnIcon, !isPlaying && styles.playBtnIconPaused]}>
              {isPlaying ? '\u23F8' : '\u25B6'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Seek bar */}
      <View style={styles.seekContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={currentPosition}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor="#d4a574"
          maximumTrackTintColor="#1a1a1a"
          thumbTintColor="#d4a574"
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatMs(currentPosition)}</Text>
          <Text style={styles.timeText}>{formatMs(duration)}</Text>
        </View>
      </View>

      {/* Speed control */}
      <View style={styles.speedRow}>
        {speeds.map((speed) => (
          <Pressable
            key={speed}
            onPress={() => handleSpeedChange(speed)}
            style={[styles.speedChip, playbackSpeed === speed && styles.speedChipActive]}
          >
            <Text style={[styles.speedText, playbackSpeed === speed && styles.speedTextActive]}>
              {speed}x
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error display */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingTop: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAudioText: {
    color: '#8a7e72',
    fontSize: 16,
  },
  controlsRow: {
    alignItems: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: '#d4a574',
  },
  playBtnPaused: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#d4a574',
  },
  playBtnIcon: {
    fontSize: 28,
    color: '#0f0f0f',
  },
  playBtnIconPaused: {
    color: '#d4a574',
  },
  seekContainer: {
    width: '100%',
    gap: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#8a7e72',
    fontSize: 13,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  speedChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  speedChipActive: {
    backgroundColor: '#d4a574',
  },
  speedText: {
    color: '#8a7e72',
    fontWeight: '700',
    fontSize: 14,
  },
  speedTextActive: {
    color: '#0f0f0f',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
  },
});
