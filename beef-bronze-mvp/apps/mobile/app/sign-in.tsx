import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { errorCode, useOtpStartMutation, useOtpVerifyMutation } from '@/store/api';
import { signIn } from '@/store/auth';
import { useAppDispatch } from '@/store';
import { Body, Button, ErrorText, Field, Screen, Title } from '@/ui';

/** Phone sign-in. Silver adds Sign in with Apple and Google (Apple requires its option when Google is offered). */
export default function SignIn() {
  const dispatch = useAppDispatch();
  const [phone, setPhone] = useState('+1');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [start, startState] = useOtpStartMutation();
  const [verify, verifyState] = useOtpVerifyMutation();

  async function onSend() {
    const r = await start({ phone: phone.trim() });
    if ('data' in r) setSent(true);
  }

  async function onVerify() {
    const r = await verify({ phone: phone.trim(), code: code.trim() });
    if ('data' in r && r.data) {
      await dispatch(signIn({ token: r.data.token, userId: r.data.userId }));
      router.replace(r.data.isNew ? '/profile-setup' : '/');
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <Title>BEEF! Conquer your hometown</Title>
        <Body muted>Sign in with your phone number. We never show it to anyone.</Body>
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={!sent}
        />
        {sent ? (
          <>
            <Field
              label="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
            />
            <Button label="Squash that beef!" onPress={onVerify} busy={verifyState.isLoading} disabled={code.length !== 6} />
            <Button label="Use a different number" kind="ghost" onPress={() => setSent(false)} />
          </>
        ) : (
          <Button label="Send code" onPress={onSend} busy={startState.isLoading} />
        )}
        <ErrorText code={errorCode(startState.error) ?? errorCode(verifyState.error)} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
