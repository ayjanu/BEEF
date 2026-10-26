# BEEF Spec 05 — Business, Venues & Go-to-Market

Oct 26, 2026 · @Ayan

## Business model

BEEF makes money on both sides, but the venue side is the moat: consumer social apps are easy to copy, verified foot traffic into local venues is not. The flywheel:

1. Players challenge each other on their phones (free, viral, cheap to serve).
2. Rivalries escalate to Level 4 at partner venues, where players earn the most Beef Points.
3. Venues get verified, booked, paying groups on slow nights and fund the perks that make Beef Points worth earning.
4. Perks and venue events pull players back to venues and attract new players; more players attract more venues.

| Revenue stream | Who pays | Model | Phase |
| --- | --- | --- | --- |
| Venue performance fee | Venue | Per verified BEEF visit, or a percentage of bookings paid through BEEF (source: 5 to 15% take rate) | Beta (waived), v1 |
| Venue portal subscription | Venue | Free tier; Pro tier for analytics, promos, featured placement | v1 |
| BEEF Pro / Champion | Player | Monthly subscription via app stores | Beta (Pro), v1 (Champion) |
| Cosmetics | Player | Fixed-price IAP: frames, avatars, victory effects, chat stickers | v1 |
| Sponsored content | Brands, venues | Native sponsored cards and branded challenges in feed; no interstitials | Scale phase |
| Sponsored tournaments | Brands, venues | Sponsor-funded prize brackets, free entry | Scale phase |
| Data partnerships | Venues, chains | Aggregated Snowflake share | Scale phase |

## Venue partner program

A venue partner is any business that hosts Level 4 games: bowling centers, pool halls, bars with darts or trivia, axe-throwing and arcade venues, table-tennis clubs. Victor's need is simple: fill slow weekday slots with groups who actually show up.

### Partner lifecycle

1. **Lead → pitch:** BizDev or self-serve sign-up from the venue portal.
2. **Onboard:** digital MSA e-signature (source kept), business verification (EIN, address, liquor license where relevant), Stripe Connect onboarding for payouts, games offered, opening hours, staffed vs self-service check-in.
3. **Configure:** slots and capacity, house rules per game, promos funded in Beef Points or discounts, staff accounts for the check-in tablet.
4. **Certify (optional but required for first meets):** Safe-Beef Certified audit.
5. **Operate:** bookings, check-ins, score confirmations, redemptions.
6. **Review:** quarterly business review with the analytics pack.

### Safe-Beef Certified

Required to host any pair's first two in-person meets (Spec 04). Audited at onboarding and re-audited quarterly (source cadence kept), with mystery visits.

| Criterion | Standard |
| --- | --- |
| Staff on site | At least one trained staff member during BEEF slots who can scan check-ins and receive discreet alerts |
| Staff training | 20-minute BEEF safety module: recognizing distress, responding to *Get me out* alerts, check-in flow |
| Public setting | Game area visible to staff; well-lit entrance and parking |
| Cameras | Working cameras covering game areas and entrance (venue-held footage) |
| Alcohol policy | Responsible-service training for staff; axe throwing and similar follow the venue's no-alcohol rules |
| Incident path | Named manager contact; incident reports to BEEF within 24 h |

Certified venues rank higher in the venue picker and display the badge.

### MSA key terms

- Venue honors posted promos and Beef Point redemptions; BEEF honors payout schedules.
- Venue may not collect BEEF user data beyond what is needed to serve the booking; no marketing to BEEF users outside the app without opt-in.
- Fraud clawback for fabricated check-ins or results.
- Mutual indemnity and insurance minimums (general liability; liquor liability where applicable), set with counsel.
- Either party may terminate on 30 days' notice; immediate termination for safety failures.

## Reservations, deposits, no-shows

No-shows are the source risk register's "high likelihood" item and the fastest way to lose a venue. Every Level 4 booking carries a deposit hold, and both players' reliability is tracked.

### Booking flow

1. Challenger picks venue, game, and slot; availability comes from the venue's BEEF calendar (beta) or its booking system via iCal or REST (v1+, source design kept).
2. Both players confirm; each card gets a **deposit hold** via Stripe (default $10 per player, venue-configurable $0 to $25). Holds are authorizations, not charges. Card authorizations generally lapse after about 7 days, so for bookings further out BEEF saves the card at booking and places the hold 48 h before the slot.
3. Venue confirms (auto-confirm for calendar-managed slots).
4. Reminders at 24 h and 1 h (source kept); either player can cancel free until the venue's window (default 4 h).
5. At the venue, staff scans each player's rotating QR → hold released, or applied to the bill if the venue prefers (deposit converts to a credit).
6. Late cancel or no-show → that player's hold is captured and paid to the venue minus BEEF's fee; the player who showed is not charged and gets a 200 BP make-good. Holds are released automatically if the venue cancels.

### Reliability score

Each player's show rate over the last 10 bookings is visible to venues and, as a simple badge ("Shows up"), to opponents. Below 70%: booking requires a higher deposit; below 50%: Level 4 paused for 30 days.

### Payments architecture

- Stripe Connect Express accounts for venues; BEEF is the platform taking an application fee.
- Deposits and venue bookings are physical services, so they run on Stripe, not app-store billing.
- Payouts weekly; venue statement shows bookings, captured no-show deposits, redemptions honored, and fees.
- Split-bill (source idea) handled by venue POS, not BEEF, in v1.

## Venue portal and analytics

The portal is a web app plus a tablet check-in mode. The sources listed more than 20 portal features; this spec ranks them so the beta ships what Victor needs on day one.

| Feature | Beta | v1 | Later |
| --- | --- | --- | --- |
| Calendar and slot management, house rules | ✓ |  |  |
| Staff accounts, tablet check-in (QR scan), score entry | ✓ |  |  |
| Promo builder (BP bonuses, discounts, "Tuesday 2x") | ✓ |  |  |
| Redemption scanner (single-use QR tokens) | ✓ |  |  |
| Discreet safety alerts to staff | ✓ |  |  |
| Dashboard: unique BEEF visitors, repeat rate, bookings, no-shows, redemptions, day-part heat map |  | ✓ |  |
| Venue leaderboards and event creation with RSVP |  | ✓ |  |
| CSV export, webhooks |  | ✓ |  |
| Booking-system integrations (iCal, REST) |  | ✓ |  |
| Lane-scoring, electronic dartboard, lap-timer integrations |  |  | ✓ |
| Snowflake data share for chains |  |  | ✓ |
| Competitive benchmarking within market |  |  | ✓ (aggregated, minimum 5 venues per benchmark) |

**Removed from the sources:** "staff performance indicators" and "customer segmentation tools" at the individual-user level. Venues see aggregates only (minimum 25 users per segment), which protects players and keeps BEEF out of data-broker territory under Texas and California privacy law.

### Venue pricing (hypothesis to validate in beta)

| Tier | Price | Includes |
| --- | --- | --- |
| Partner | Free + performance fee per verified BEEF visit | Listing, bookings, check-in, promos, basic stats |
| Partner Pro | Monthly fee + lower per-visit fee | Full dashboard, featured placement, events, exports |

Beta venues pay nothing for 90 days in exchange for feedback and case-study rights.

## Consumer monetization

The sources listed a $4.99 Battle Pass *and* a $4.99 Pro tier, plus a Champion tier with a "monthly Beef Point stipend." A stipend makes Beef Points purchasable, which breaks the economy rule in Spec 02 and creates the gambling-element problem in Spec 04. The fix: two subscription tiers, with the seasonal cosmetic track inside Pro, and no points for money anywhere.

|  | Free | BEEF Pro, $4.99/mo | BEEF Champion, $9.99/mo |
| --- | --- | --- | --- |
| Daily right-swipes | 50 | Unlimited | Unlimited |
| See who challenged or liked you | Blurred | ✓ | ✓ |
| Advanced stats, head-to-head history, rating graphs | Basic | ✓ | ✓ |
| Season cosmetic track (replaces Battle Pass) | Free lane | Premium lane | Premium lane |
| Ads (sponsored cards) | Yes | None | None |
| Profile boost |  | 1 per week | 2 per week |
| Early access to new games |  |  | ✓ |
| Exclusive cosmetic set each season |  |  | ✓ |
| Venue VIP offers (venue-funded) |  |  | ✓ |
| Priority support |  |  | ✓ |
| **Never sold** | Beef Points, rating, matchmaking priority, safety features, verification |  |  |

Safety features (Shield, check-ins, emergency, blocking, reporting) are free forever and never upsold.

**Annual plans:** Pro $39.99/yr, Champion $79.99/yr (hypothesis). **Store fees:** subscriptions sold through Apple and Google; the Apple Small Business Program and second-year subscription rates reduce the store commission to 15% where eligible. US web checkout is allowed after Epic v. Apple but the permitted Apple commission is unsettled; ship it behind a flag and test.

### Cosmetics

Fixed-price, no randomized loot boxes (they invite gambling-style regulation and rating changes in some markets). Items: profile frames, animated avatars, victory stingers, rematch taunts, chat stickers, game skins (table felts, chess sets). Price range $0.99 to $9.99.

### Ads

No interstitials (source idea dropped: they interrupt games and hurt retention). Native sponsored cards only: venue promos, branded challenges ("Beat the brand's ambassador at Word Blitz"), sponsored tournaments. Frequency cap 1 per 8 feed cards. Never in chats, never in safety flows.

### Tournaments and creators

Tournaments are free to enter with sponsor-funded prizes (Spec 04). Creator monetization (viewers buying cosmetic gifts for streamers, with a revenue share) is deferred to the scale phase because it needs payout KYC, tax reporting, and fraud controls.

## Unit economics model

No market data in the sources supports specific revenue figures, so this section defines the model and the inputs the beta must measure. Every number below is a placeholder hypothesis, labeled as such, to be replaced with beta data.

```latex
ARPMAU = c_{sub} \times P_{net} + A_{ads} + v \times f_{visit} + c_{cos} \times S_{cos}
```

| Input | Meaning | Placeholder hypothesis | Measured in beta by |
| --- | --- | --- | --- |
| c\_sub | Share of monthly actives paying for Pro or Champion | 4% | Store and RevenueCat data |
| P\_net | Blended subscription revenue per payer after store fees | $4.80 | RevenueCat |
| A\_ads | Sponsored-card revenue per monthly active | $0 in beta | Ad server (v1+) |
| v | Verified venue visits per monthly active | 0.3 | Check-in records |
| f\_visit | Venue performance fee per verified visit | $2.00 | Venue invoices |
| c\_cos | Share of monthly actives buying cosmetics | 2% | Store data |
| S\_cos | Cosmetic spend per buyer per month, net | $3.00 | Store data |

With the placeholders, ARPMAU ≈ 0.04 × 4.80 + 0 + 0.3 × 2.00 + 0.02 × 3.00 ≈ $0.85, of which about 70% comes from venues. That is the thesis to test: **venue revenue per player, not subscriptions, is what makes BEEF a business.**

### Cost drivers to track per monthly active

| Cost | Driver | Control |
| --- | --- | --- |
| Identity verification | V1 and V2 checks per new user | Verify only when a feature needs it (Spec 01 onboarding) |
| Screening | V3 registry screens | Only for users who open Level 4 |
| Media | Streams, clips, Level 3 uploads | Recording opt-in; 30-day raw retention |
| Moderation | Reviewer hours per 1,000 actives | Classifier precision; queue tooling |
| Beef Point redemptions | BEEF-funded perks only | Monthly perk budget; venue-funded offers preferred |
| Emergency dispatch | Per-user or per-alert vendor fee | Negotiate per active-user pricing |

### Assumptions the beta must validate

- [ ] Pairs reach Level 4 at a rate that makes venue revenue meaningful (target 5% of pairs, Spec 01)
- [ ] Venues will pay a per-visit fee after the free 90 days
- [ ] Deposits cut no-shows below 10%
- [ ] Verification friction at V1 does not drop swipe-tab activation below 50%
- [ ] Campus launches produce organic referral (k-factor above 0.3 among students)

## Go-to-market

Launch dense, not wide. A social app with too few nearby people feels dead, so BEEF launches in one metro, Dallas–Fort Worth, and inside it starts with campuses and venue clusters where density comes fastest. Austin and Houston follow (source plan kept); national comes only after the Level 4 loop works in Texas.

### Launch sequence

| Step | Who | Goal |
| --- | --- | --- |
| 1. Venue pilot | 5 to 10 DFW venues: bowling, pool and darts bars, trivia nights, one axe-throwing venue | Every beta user has a certified venue within 15 minutes |
| 2. Campus beta | 2 to 3 DFW campuses; student ambassadors (source idea kept); student orgs run welcome-week brackets | 3,000 to 5,000 beta users with high local density |
| 3. Venue nights | Weekly BEEF nights at pilot venues with promos | Prove the Level 4 loop and no-show controls |
| 4. Creator seeding | 10 to 20 local streamers and creators with rivalries and dual streams | Content for the feed; reach beyond campus |
| 5. DFW public launch | Store release, referral program, Season 1 | Metro-wide density |
| 6. Austin, Houston | Repeat the playbook | Prove repeatability |

### Channels

- **Campus:** ambassadors, orientation and greek-life brackets, campus venue partners. Campus events check age at the door (18+).
- **Venues:** in-venue QR signage ("Settle it on BEEF"), staff referral codes, co-branded events.
- **Creators:** rivalry series, dual streams, local leaderboards as content.
- **Corporate:** team-building brackets and icebreakers (source idea kept) as a v1 add-on for HR teams, sold through venues.
- **Paid:** only after organic retention clears targets; measured with AdAttributionKit and incrementality tests.

### Funding milestones

The source planned an angel round for launch. Tie each raise to a proof point rather than a date:

| Round | Funds | Proof point to raise the next |
| --- | --- | --- |
| Pre-seed / angel | Phases 0 to 2 (Spec 06) | DFW beta retention and Level 4 conversion at target |
| Seed | Phases 3 to 4 | DFW launch cohort economics; second-city repeat |
| Series A | Phase 5+ | Multi-city venue network, positive contribution per venue |

### Sources

- [Texas AG Opinion GA-0926 on skill-contest entry fees](https://www.oag.state.tx.us/opinions/greg-abbott/ga-0926)
- [Epic v. Apple external-link commission status](https://thenextweb.com/news/supreme-court-apple-epic-contempt-app-store-commission)
- [AdAttributionKit status](https://deeplinks.linkrunner.io/blog/adattributionkit-vs-skan)
