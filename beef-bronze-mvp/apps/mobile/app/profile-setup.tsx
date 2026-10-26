import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Intent } from '@beef/contracts';
import { errorCode, useDevLivenessMutation, useUpdateProfileMutation } from '@/store/api';
import { signIn } from '@/store/auth';
import { useAppDispatch, useAppSelector } from '@/store';
import { colors, space } from '@/theme';
import { Body, Button, ErrorText, Field, Screen } from '@/ui';

const INTENTS: Array<{ id: Intent; label: string; color: string }> = [
  { id: 'platonic', label: 'Friends & rivals', color: colors.blue },
  { id: 'romantic', label: 'Dating', color: colors.pink },
];

/**
 * Basics, intent, and (dev only) the V1 liveness stub. Privacy defaults are the
 * most private option (Spec 01); Silver adds the full privacy step and the real
 * selfie check from the identity vendor.
 */
export default function ProfileSetup() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.userId);
  const [displayName, setName] = useState('');
  const [birthDate, setBirth] = useState('');
  const [intents, setIntents] = useState<Intent[]>(['platonic']);
  const [save, saveState] = useUpdateProfileMutation();
  const [liveness, livenessState] = useDevLivenessMutation();

  const toggle = (i: Intent) =>
    setIntents((cur) => (cur.includes(i) ? (cur.length > 1 ? cur.filter((x) => x !== i) : cur) : [...cur, i]));

  async function onSave() {
    const r = await save({ displayName, birthDate, intents, games: ['four-up'] });
    if (!('data' in r)) return;
    const v = await liveness();
    if ('data' in v && v.data && userId) await dispatch(signIn({ token: v.data.token, userId }));
    router.replace('/match');
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Field label="Display name" value={displayName} onChangeText={setName} maxLength={30} autoCapitalize="words" />
        <Field
          label="Birth date (YYYY-MM-DD)"
          value={birthDate}
          onChangeText={setBirth}
          placeholder="1999-04-02"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Body muted>What are you here for? Matches only see people with an intent in common.</Body>
        <View style={{ flexDirection: 'row', gap: space(1), marginVertical: space(2) }}>
          {INTENTS.map((i) => {
            const on = intents.includes(i.id);
            return (
              <Pressable
                key={i.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(i.id)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: on ? i.color : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Color is never the only signal: the check mark and label carry it too. */}
                <Text style={{ color: colors.text, fontSize: 16 }}>{(on ? '✓ ' : '') + i.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          label="Gloves off"
          onPress={onSave}
          busy={saveState.isLoading || livenessState.isLoading}
          disabled={!displayName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)}
        />
        <ErrorText code={errorCode(saveState.error) ?? errorCode(livenessState.error)} />
      </ScrollView>
    </Screen>
  );
}
