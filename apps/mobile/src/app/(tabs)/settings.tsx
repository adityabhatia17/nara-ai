/**
 * Settings Screen
 * Notification preferences, timezone, quiet hours, and account deletion.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
// useRouter is not needed currently but kept for future navigation needs
// import { useRouter } from 'expo-router';

import { colors, typography, spacing } from '@/theme/tokens';
import { api } from '@/lib/api';
import { signOut } from '@/lib/auth';
import type { NotificationPreferences } from '@nara/shared';

export default function SettingsScreen() {

  const [timezone, setTimezone] = useState('UTC');
  const [quietHoursStart, setQuietHoursStart] = useState(22);
  const [quietHoursEnd, setQuietHoursEnd] = useState(8);
  const [enabledTypes, setEnabledTypes] = useState<string[]>([
    'inactivity',
    'loose_end',
    'pattern',
  ]);

  // Fetch current preferences
  const { isLoading: prefsLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: async () => {
      const response = await api.get<NotificationPreferences>(
        '/notifications/preferences'
      );
      const prefs = response.data;
      setTimezone(prefs.timezone);
      setQuietHoursStart(prefs.quiet_hours_start);
      setQuietHoursEnd(prefs.quiet_hours_end);
      setEnabledTypes(prefs.enabled_types);
      return prefs;
    },
    retry: 1,
  });

  // Update preferences mutation
  const { mutate: updatePreferences, isPending: updating } = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      const response = await api.put('/notifications/preferences', data);
      return response.data;
    },
    onSuccess: () => {
      // Optional: show confirmation toast
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to update preferences');
      console.error(error);
    },
  });

  // Delete account mutation
  const { mutate: deleteAccount, isPending: deleting } = useMutation({
    mutationFn: async () => {
      await api.delete('/account');
    },
    onSuccess: async () => {
      await signOut();
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to delete account');
      console.error(error);
    },
  });

  const handleQuietHoursStartChange = (value: number) => {
    setQuietHoursStart(value);
    updatePreferences({ quiet_hours_start: value });
  };

  const handleQuietHoursEndChange = (value: number) => {
    setQuietHoursEnd(value);
    updatePreferences({ quiet_hours_end: value });
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    updatePreferences({ timezone: tz });
  };

  const toggleNotificationType = (type: string) => {
    const updated = enabledTypes.includes(type)
      ? enabledTypes.filter((t) => t !== type)
      : [...enabledTypes, type];
    setEnabledTypes(updated);
    updatePreferences({ enabled_types: updated as any });
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteAccount(),
        },
      ]
    );
  };

  if (prefsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Quiet Hours Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Start time</Text>
            <HourPicker
              value={quietHoursStart}
              onChange={handleQuietHoursStartChange}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>End time</Text>
            <HourPicker
              value={quietHoursEnd}
              onChange={handleQuietHoursEndChange}
            />
          </View>
        </View>

        {/* Timezone Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timezone</Text>
          <Text style={styles.settingValue}>{timezone}</Text>
          <Text style={styles.settingHint}>
            Current: {timezone}. Contact support to change.
          </Text>
        </View>

        {/* Notification Types Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Inactivity nudges</Text>
            <Switch
              value={enabledTypes.includes('inactivity')}
              onValueChange={() => toggleNotificationType('inactivity')}
              trackColor={{ false: colors.faint, true: colors.accent }}
              disabled={updating}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Loose end reminders</Text>
            <Switch
              value={enabledTypes.includes('loose_end')}
              onValueChange={() => toggleNotificationType('loose_end')}
              trackColor={{ false: colors.faint, true: colors.accent }}
              disabled={updating}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Pattern insights</Text>
            <Switch
              value={enabledTypes.includes('pattern')}
              onValueChange={() => toggleNotificationType('pattern')}
              trackColor={{ false: colors.faint, true: colors.accent }}
              disabled={updating}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Unresolved items</Text>
            <Switch
              value={enabledTypes.includes('unresolved')}
              onValueChange={() => toggleNotificationType('unresolved')}
              trackColor={{ false: colors.faint, true: colors.accent }}
              disabled={updating}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Entity silence alerts</Text>
            <Switch
              value={enabledTypes.includes('entity_silence')}
              onValueChange={() => toggleNotificationType('entity_silence')}
              trackColor={{ false: colors.faint, true: colors.accent }}
              disabled={updating}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Pressable
            onPress={confirmDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Hour Picker Component
 * Simple number selector for quiet hours.
 */
function HourPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (hour: number) => void;
}) {
  return (
    <View style={styles.hourPickerContainer}>
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        style={styles.hourButton}
      >
        <Text style={styles.hourButtonText}>−</Text>
      </Pressable>
      <Text style={styles.hourValue}>
        {value.toString().padStart(2, '0')}:00
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(23, value + 1))}
        style={styles.hourButton}
      >
        <Text style={styles.hourButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: typography.display.fontSize,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  dangerSection: {
    marginBottom: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopColor: colors.border.card,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.body,
  },
  settingValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  settingHint: {
    fontSize: typography.meta.fontSize,
    color: colors.faint,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomColor: colors.border.card,
    borderBottomWidth: 1,
  },
  toggleLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.body,
    flex: 1,
  },
  hourPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hourButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.border.card,
    borderWidth: 1,
  },
  hourButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  hourValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.ink,
    minWidth: 50,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  deleteButtonPressed: {
    opacity: 0.85,
  },
  deleteButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.card,
  },
  spacer: {
    height: spacing.xxl,
  },
});
