import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from './theme';

export function Screen({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {title ? <Title>{title}</Title> : null}
      {children}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        kind === 'ghost' && styles.ghost,
        (pressed || off) && { opacity: 0.6 },
      ]}
    >
      {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: space(2) }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function ErrorText({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.error}>
      {MESSAGES[code] ?? `Something went wrong (${code}).`}
    </Text>
  );
}

/** Plain-language messages for server error codes. Safety and legal copy stays plain (Spec 01). */
const MESSAGES: Record<string, string> = {
  bad_code: 'That code is not right. Check it and try again.',
  too_many_attempts: 'Too many tries. Wait a few minutes and try again.',
  under_18: 'BEEF is for adults 18 and over.',
  verification_required: 'Verify your identity to use this feature.',
  daily_swipe_limit: 'You have used today’s challenges. More tomorrow, or go Pro.',
  not_matched: 'You can only challenge people you have matched with.',
  challenge_not_open: 'That challenge is no longer open.',
  validation_failed: 'Some details are missing or invalid.',
  text_blocked: 'That breaks the community rules. Try rewording it.',
  safety_unavailable: 'We couldn’t check that just now. Try again in a moment.',
  rematch_already_offered: 'You already asked for a rematch.',
  not_found: 'That’s no longer available.',
  certified_venue_required: 'Your first two meets with someone happen at Safe-Beef Certified venues.',
  opponent_not_verified: 'They need to finish verification before meeting in person.',
  slot_full: 'That time is fully booked.',
  checkin_not_open: 'Check-in opens 30 minutes before your time.',
  already_booked_then: 'One of you already has a booking at that time.',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(2) },
  title: { fontFamily: fonts.display, fontSize: 40, color: colors.text, marginTop: space(1), marginBottom: space(2) },
  body: { fontSize: 16, lineHeight: 22, color: colors.text },
  label: { color: colors.muted, fontSize: 14, marginBottom: space(0.5) },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space(1.5),
    fontSize: 17,
  },
  button: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
    marginVertical: space(1),
  },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(2),
    marginBottom: space(1.5),
  },
  error: { color: colors.warn, marginVertical: space(1), fontSize: 15 },
});
