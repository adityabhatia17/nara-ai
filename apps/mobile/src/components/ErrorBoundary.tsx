/**
 * ErrorBoundary
 * Catches any uncaught React render errors and shows a friendly recovery UI
 * instead of a blank screen. Wraps the root layout in _layout.tsx.
 */

import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, radius } from '@/theme/tokens';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd send this to Sentry / Datadog
    console.error('[ErrorBoundary]', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            {this.state.errorMessage || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    fontFamily: 'SchibstedGrotesk_700Bold',
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.subInk,
    textAlign: 'center',
    fontFamily: 'SchibstedGrotesk_400Regular',
  },
  button: {
    backgroundColor: colors.ink,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.card,
    marginTop: spacing.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.card,
    fontFamily: 'SchibstedGrotesk_600SemiBold',
  },
});
