import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { errorCode, useCheckinTokenQuery, useMeetFeedbackMutation, useShieldMutation } from '@/store/api';
import { colors, space } from '@/theme';
import { Body, Button, ErrorText, Screen } from '@/ui';

/**
 * The meet screen: the check-in QR for venue staff (refreshed every 60 s; each
 * code lives 2 minutes) and the Shield, always visible (Spec 04).
 */
export default function Meet() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const qr = useCheckinTokenQuery(bookingId, { pollingInterval: 60_000 });
  const [shield, shieldState] = useShieldMutation();
  const [feedback, feedbackState] = useMeetFeedbackMutation();
  const [note, setNote] = useState<string | null>(null);

  async function emergency() {
    // Dial first; the server-side alert runs in parallel and never delays the call.
    void Linking.openURL('tel:911');
    await shield({ id: bookingId, kind: 'emergency' });
  }

  return (
    <Screen title="Your meet">
      <View style={{ alignItems: 'center', padding: space(2), backgroundColor: '#FFFFFF', borderRadius: 16 }}>
        {qr.data ? <QRCode value={qr.data.token} size={220} /> : <Text>…</Text>}
      </View>
      <Body muted>Show this to venue staff to check in.</Body>
      <ErrorText code={errorCode(qr.error) ?? errorCode(shieldState.error)} />

      <Text style={{ color: colors.muted, marginTop: space(2) }}>SHIELD</Text>
      <View style={{ gap: space(1) }}>
        <Button label="I’m OK" kind="ghost" onPress={async () => (await shield({ id: bookingId, kind: 'ok' }), setNote('Thanks. We’ll check in again at the end.'))} />
        <Button
          label="Get me out"
          kind="ghost"
          onPress={async () => (await shield({ id: bookingId, kind: 'get_me_out' }), setNote('Venue staff have been told quietly. Your phone will ring shortly.'))}
        />
        <Button label="Alert my contacts" kind="ghost" onPress={async () => (await shield({ id: bookingId, kind: 'alert_contacts' }), setNote('Your contacts have your meet plan.'))} />
        <Button label="Emergency (call 911)" onPress={() => void emergency()} />
      </View>
      {note ? <Body>{note}</Body> : null}

      <Text style={{ color: colors.muted, marginTop: space(2) }}>AFTER THE MEET (PRIVATE)</Text>
      {feedbackState.isSuccess ? (
        <Body muted>Thanks. This is never shown to the other player.</Body>
      ) : (
        <View style={{ flexDirection: 'row', gap: space(1) }}>
          <Button label="I felt safe" kind="ghost" onPress={() => void feedback({ id: bookingId, feltSafe: true })} />
          <Button label="I didn’t" kind="ghost" onPress={() => void feedback({ id: bookingId, feltSafe: false })} />
        </View>
      )}
    </Screen>
  );
}
