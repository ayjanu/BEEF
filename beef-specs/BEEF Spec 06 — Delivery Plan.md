# BEEF Spec 06 — Delivery Plan

Oct 26, 2026 · @Ayan

## Roadmap

The plan re-bases the sources' stale 2025 dates to a November 2026 kickoff: DFW beta opens in June 2027, campus beta lands at fall welcome week, and the target store release is mid-October 2027.

&#91;embedded content: BEEF roadmap · 6 phases, Nov 2026 to Sep 2028\]

Dates are planned, not promised: each phase starts only when the previous gate's exit criteria are met (next section). The campus date assumes mid-August move-in; confirm per campus.

## Phase scope and exit criteria

Each phase ends at a gate: the next phase starts only when its exit criteria are met, not when the calendar says so. The source's six-phase shape is kept; durations are adjusted so the DFW beta overlaps the August 2027 fall semester start, and Level 4 moves from Phase 4 into the beta.

| Phase | Dates (planned) | Scope | Exit criteria (gate) |
| --- | --- | --- | --- |
| 0. Foundation | Nov 2026 – Jan 2027 | Company and counsel set up; trademark search; brand and logo testing; Figma hero journeys (8-Ball, Would You Rather, Push-Ups, Bowling, per source); design system; infra baseline; proof of concept: Chess in chat over Phoenix; venue letters of intent | 5 signed venue LOIs; POC p95 move round trip under 70 ms; counsel engaged on Spec 04 questions; core team hired |
| 1. Closed alpha | Feb – May 2027 | Onboarding V0 and V1; Match swipe and challenge builder; chat; 8 Level 1 and 4 Level 2 titles; economy ledger; ratings; moderation v1; admin console | 200 testers; crash-free 99% or higher; activation (first game in 24 h) 50% or higher; zero open critical security findings |
| 2. DFW beta | Jun – Sep 2027 | V2 and V3; Level 3 (4 titles) and Level 4 (4 titles) with venue pilot; venue portal beta; feed, stories, result cards; Shield, check-ins, dispatch; takedown and NCMEC flows; BEEF Pro; campus launch at welcome week | 3,000+ beta users; D7 retention 20%; 5% of pairs reach Level 4; no-show rate under 10%; safety SLAs met for 4 consecutive weeks; pentest passed |
| 3. DFW public launch | Oct – Nov 2027 | Store release (DFW-focused marketing, available in the US); live streaming; v1 catalog (26 titles); referral program; Season 1; SOC 2 Type I | Load test gate passed; crash-free 99.5%; store rating 4.5 or higher; 15+ live venues |
| 4. Texas scale | Dec 2027 – May 2028 | Austin and Houston; Champion tier; sponsored cards; venue integrations (booking systems); pose-AI ranked Level 3; Spanish localization | Second-city retention within 80% of DFW; positive contribution per venue |
| 5. Expansion and esports | Jun – Sep 2028 | Additional states; collegiate circuit (source idea); creator tools; sponsored tournaments; international readiness review (GDPR, DSA, ISO 27001) | Board decision on national and international expansion |

## Team and hiring plan

The kept stack spans TypeScript, Go, Elixir, and Python, so early hires must be full-stack generalists who can own a service each; the plan below grows from 9 to 16 people by public launch. Legal, pentest, SOC 2 audit, and brand design are contracted.

| Role | Count | Starts | Owns |
| --- | --- | --- | --- |
| Founder / CEO (product) | 1 | P0 | Vision, fundraising, venue relationships early on |
| CTO / engineering lead | 1 | P0 | Architecture (Spec 03), hiring, security |
| Mobile engineers (React Native) | 3 | 2 in P0, 1 in P1 | App shell, Match, chat UI, Level 3 capture |
| Backend engineers | 3 | 2 in P0, 1 in P1 | Core API (TS); one owns Go matchmaking; one owns Phoenix chat |
| Game engineer (Skia, rules engine) | 1 | P0 | Game framework and Level 1 titles |
| ML engineer (vision + safety) | 1 | P1 | Pose verification, classifier pipeline |
| Product designer | 1 | P0 | UX, design system, motion |
| QA / test automation | 1 | P1 | Test matrix, device lab, release checks |
| Trust and safety lead | 1 | P1 | Policies, moderation ops, vendor reviewers, NCMEC and takedown SOPs |
| Venue partnerships lead | 1 | P0 | Venue LOIs, onboarding, certification audits |
| Community and campus manager | 1 | P2 | Ambassadors, campus events, creator seeding |
| Support and moderation (vendor or contract) | 2+ | P2 | 24/7 high-severity coverage from launch |

**Hiring risk:** Elixir engineers are scarcer than TypeScript engineers. If the chat hire slips more than 6 weeks, the contingency is to keep chat on Phoenix but contract an Elixir specialist for the build and train an in-house owner.

## Budget estimate

Planning estimate only: about $4.2M from November 2026 through DFW public launch, of which about $3.2M covers Phases 0 to 2 (the pre-seed raise). People are about 62% of spend. The figures assume a fully loaded average of $15,000 per team member per month; replace them with actual offers and vendor quotes in Phase 0.

| Category | P0 (3 mo) | P1 (4 mo) | P2 (4 mo) | P3 (2 mo) | Total |
| --- | --- | --- | --- | --- | --- |
| Team (9 → 14 → 15 → 16 people) | $405k | $840k | $900k | $480k | $2.63M |
| Infrastructure and vendors (AWS, LiveKit, identity, screening, dispatch, moderation, SMS) | $30k | $80k | $180k | $120k | $0.41M |
| Legal, compliance, security (counsel, SOC 2 readiness and Type I audit, pentest, trademark) | $60k | $50k | $90k | $50k | $0.25M |
| Marketing (campus, venue nights, creators, launch) | $0 | $0 | $150k | $250k | $0.40M |
| Contingency (15%) | $74k | $146k | $198k | $135k | $0.55M |
| **Total** | **$569k** | **$1.12M** | **$1.52M** | **$1.04M** | **$4.24M** |

## Quality, testing, and release criteria

The source testing matrix is kept and extended to cover what makes BEEF risky: safety flows, verification, and the economy.

| Test type | Standard | Change from source |
| --- | --- | --- |
| Unit | 85%+ line coverage on business logic; 100% on game rules modules and the BP ledger | Rules and ledger raised to 100% |
| Contract and integration | Every GraphQL schema change and REST endpoint has contract tests in CI; vendor sandboxes (identity, Stripe, dispatch) exercised nightly | Postman replaced by code-based contract tests |
| End-to-end | Maestro flows on real devices for the golden journeys: onboard → match → play → win → share; book → check in → verify → redeem; report → action | Playwright is web-only; Maestro fits React Native |
| Game determinism | Replay every recorded session from seed + move log in CI; any divergence fails the build | New |
| Load | k6: 50,000 concurrent game sessions, 200,000 chat sockets, SLOs held 30 min | Chat added |
| Chaos | Monthly game day in staging: packet loss, Postgres failover, Redis loss, vendor outage | Kept |
| Safety drills | Monthly: emergency alert end to end with the dispatch sandbox; NCII takedown under 48 h; NCMEC report flow tabletop | New, launch-blocking |
| Pose accuracy | 500-clip labeled set per Level 3 title, balanced across body types, skin tones, lighting; ±1 rep on 95% | New |
| Accessibility | WCAG 2.2 AA via automated checks plus manual VoiceOver and TalkBack passes on every release | Manual pass added |
| Security | SAST and dependency scans per PR; external pentest before beta and before launch | Kept, timing set |

### Release criteria for public launch

- [ ] Crash-free sessions 99.5% or higher over a 30-day beta (source kept)
- [ ] Median time to match under 10 s at medium load (source kept)
- [ ] Tutorial completion 80% or higher (source kept)
- [ ] All Spec 04 launch documents published and counsel sign-off recorded
- [ ] Safety SLAs met for 4 consecutive weeks; emergency relay p99 under 5 s
- [ ] Zero open critical or high security findings
- [ ] SOC 2 Type I report issued

The source's "App Store rating 4.5 after 10,000 reviews" is a post-launch health goal, not a launch gate; it cannot be met before launch.

## Risk register

Sorted by impact × likelihood. Source risks are kept; new risks found in this review are marked *(new)*.

| Risk | Impact | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Harm at an in-person meet *(new)* | Severe | Medium | V3, first-meet-at-certified-venue rule, Shield and dispatch, venue staff training | T&S lead |
| Cold start: not enough people nearby *(new)* | High | High | Single-metro launch, campus density, cross-region fallback for Levels 1 and 2 | CEO |
| Partner no-shows | Medium | High | Deposits, reliability score, make-good BP | Venue lead |
| Points farming and collusion *(new)* | High | Medium | Earn-only BP, diminishing returns, caps, integrity score | CTO |
| Gambling classification of any feature *(new)* | High | Low (by design) | No staking, no purchasable points, no paid entry until counsel memo | CEO + counsel |
| Live-stream abuse | High | Medium | V2 required, 30 s delay, live classifiers, one-tap kill | T&S lead |
| Match queue scaling | High | Medium | Region shards, Karpenter autoscaling, load gate | CTO |
| Regulatory shift on age assurance (SB 2420 appeal outcome, new state laws) | High | Medium | 18+ only; store age signals behind one interface; counsel monitoring | Counsel |
| Store rejection *(new)* | High | Medium | Guideline checklist (Spec 04), pre-submission review, no downloaded game code | CTO |
| Trademark conflict on "BEEF" *(new)* | Medium | Medium | Clearance search in Phase 0; fallback name shortlist | CEO |
| Apple tracking and attribution changes | Medium | Medium | AdAttributionKit, server-side events, organic-first growth | Growth |
| Elixir hiring delay *(new)* | Medium | Medium | Contract specialist; documented runbooks | CTO |
| Venue churn after free period *(new)* | High | Medium | Prove visits in dashboard; per-visit pricing tied to value | Venue lead |

## First 30 days

These are the actions that unblock Phase 0, ordered by what gates the most downstream work.

- [ ] Engage a startup law firm; send the six counsel questions from Spec 04; start trademark clearance on BEEF
- [ ] Form the entity and open Stripe, Apple Developer, and Google Play accounts (organization accounts, D-U-N-S number)
- [ ] Hire or contract the CTO and first two engineers; set up the GitHub org, AWS org with SSO, and Terraform baseline
- [ ] Brand sprint: test bull-mark vs brass-knuckle logo with 20+ target users; lock provisional tokens
- [ ] Figma hero journeys: 8-Ball in chat, Would You Rather, 60-Second Push-Ups, Bowling booking (source's four, kept)
- [ ] Engineering spike: Chess over Phoenix + Node game worker; measure p95 move round trip against the 70 ms target
- [ ] Venue outreach: 25 DFW venues contacted, 10 meetings, 5 letters of intent (bowling, pool and darts bars, trivia, axe throwing)
- [ ] Vendor shortlist and quotes: identity (Persona, Stripe Identity, Onfido), emergency dispatch, hash matching, LiveKit Cloud
- [ ] Pre-seed deck built from Specs 01, 05, and 06

### Sources

Dates and durations are re-based from the source drafts (whose 2025 milestones have passed). External facts used in planning are cited in Specs 01, 03, and 04; budget figures are planning assumptions, not quotes.
