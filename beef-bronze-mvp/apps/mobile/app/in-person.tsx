import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { Booking, Venue } from '@beef/contracts';
import {
  errorCode,
  useAcceptBookingMutation,
  useBookMutation,
  useBookingsQuery,
  useThreadsQuery,
  useVenueSlotsQuery,
  useVenuesQuery,
} from '@/store/api';
import { useAppSelector } from '@/store';
import { colors, space } from '@/theme';
import { Body, Button, ErrorText, Screen, styles } from '@/ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Level 4 ("BEEF!"): settle it in person at a partner venue. Both players are
 * ID-verified (V3), first meets are at Safe-Beef Certified venues, staff check
 * you in by QR and confirm the result. No money changes hands in the app.
 */
export default function InPerson() {
  const me = useAppSelector((s) => s.auth.userId);
  const bookings = useBookingsQuery();
  const venues = useVenuesQuery();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [accept, acceptState] = useAcceptBookingMutation();
  const upcoming = (bookings.data ?? []).filter((b) => ['invited', 'confirmed', 'checked_in'].includes(b.state));

  return (
    <Screen title="BEEF! in person">
      <Body muted>Meet in public, at partner venues with staff on site. Verification lowers risk but never removes it.</Body>
      <ErrorText code={errorCode(acceptState.error)} />
      {upcoming.map((b) => (
        <BookingCard
          key={b.id}
          b={b}
          me={me}
          onAccept={() => void accept({ id: b.id, sharePlan: true })}
        />
      ))}
      <Text style={{ color: colors.muted, marginVertical: space(1) }}>VENUES</Text>
      {venue ? (
        <SlotPicker venue={venue} onBack={() => setVenue(null)} />
      ) : (
        <FlatList
          data={venues.data ?? []}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => setVenue(item)} style={styles.card}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
                {item.name} {item.safeCertified ? '🛡️' : ''}
              </Text>
              <Body muted>
                {item.address}, {item.city}
              </Body>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function BookingCard({ b, me, onAccept }: { b: Booking; me: string | null; onAccept: () => void }) {
  const invitedMe = b.state === 'invited' && b.guestId === me;
  return (
    <View style={[styles.card, { borderColor: colors.red }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {b.slot.gameId} at {b.venue.name}
      </Text>
      <Body muted>
        {when(b.slot.startsAt)} · {b.state.replace('_', ' ')}
      </Body>
      {invitedMe ? <Button label="Accept and share my meet plan" onPress={onAccept} /> : null}
      {b.state === 'confirmed' || b.state === 'checked_in' ? (
        <Button label="Open meet" onPress={() => router.push({ pathname: '/meet/[bookingId]', params: { bookingId: b.id } })} />
      ) : null}
    </View>
  );
}

function SlotPicker({ venue, onBack }: { venue: Venue; onBack: () => void }) {
  const me = useAppSelector((s) => s.auth.userId);
  const slots = useVenueSlotsQuery(venue.id);
  const threads = useThreadsQuery();
  const opponents = (threads.data ?? []).flatMap((t) => t.members.filter((m) => m.userId !== me));
  const [guestId, setGuestId] = useState<string | null>(null);
  const [book, bookState] = useBookMutation();

  return (
    <View>
      <Pressable accessibilityRole="button" onPress={onBack}>
        <Text style={{ color: colors.muted }}>‹ All venues</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginVertical: space(1) }}>{venue.name}</Text>
      <Body muted>Who are you settling it with?</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1), marginVertical: space(1) }}>
        {opponents.map((o) => (
          <Pressable
            key={o.userId}
            accessibilityRole="button"
            accessibilityState={{ selected: guestId === o.userId }}
            onPress={() => setGuestId(o.userId)}
            style={{ padding: space(1), borderRadius: 999, borderWidth: 1, borderColor: guestId === o.userId ? colors.red : colors.border }}
          >
            <Text style={{ color: colors.text }}>{o.displayName}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText code={errorCode(bookState.error)} />
      {(slots.data ?? []).map((s) => (
        <View key={s.id} style={styles.card}>
          <Body>
            {s.gameId} · {when(s.startsAt)} · {s.available} left
          </Body>
          <Button
            label="Book it"
            disabled={!guestId || s.available === 0}
            busy={bookState.isLoading}
            onPress={() => guestId && void book({ slotId: s.id, guestId, sharePlan: true })}
          />
        </View>
      ))}
    </View>
  );
}
