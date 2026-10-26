# BEEF Spec 04 — Trust, Safety, Privacy & Legal

Oct 26, 2026 · @Ayan

This is a product specification, not legal advice. Every legal conclusion here needs sign-off from licensed counsel before launch.

## Risk posture

BEEF combines the three riskiest patterns in consumer social: stranger matching (dating), user video and live streaming (social), and arranged in-person meetings (events). Safety is therefore a launch-blocking product surface, not a policy page. The governing principles:

1. **Adults only.** No minors on the platform in any mode (Age assurance).
2. **Escalate trust with risk.** Each step toward meeting in person requires more verification (V-tiers, Spec 01).
3. **First meets in public, supervised places.** Partner venues are the safety model, not just the revenue model.
4. **Verification is not a safety guarantee,** and the product never implies it is.
5. **Users control what others see**: privacy defaults are the most private setting.
6. **Humans decide serious outcomes.** Models flag, people ban (except hash-matched CSAM).
7. **Fast, documented response** for the categories where law sets the clock (NCII 48 h; NCMEC reports "as soon as reasonably possible").

**Staffing implication:** a trust and safety lead is a pre-beta hire, with 24/7 coverage for high-severity reports from public launch (in-house or a vendor with BEEF-trained reviewers).

## Age assurance: 18+ only

The sources planned COPPA safe-mode, parental dashboards, and minors in Level 1. This spec removes minors entirely. A stranger-matching app with a romantic mode, live video, and in-person meetups cannot be made safe enough for minors by settings alone, and the legal surface has grown sharply in 2026:

- The FTC's amended COPPA Rule became enforceable on April 22, 2026, expanding notice, retention, and security duties for services with child users.
- Texas SB 2420 (App Store Accountability Act) has been enforceable since the Fifth Circuit's June 2026 stay of the injunction, and the Supreme Court declined to vacate that stay on July 6, 2026. The merits appeal is still pending. It requires age verification and parental consent flows at the app-store layer, with developer-side obligations, and similar laws exist in Utah, Louisiana, and California.

### Implementation

| Layer | Requirement |
| --- | --- |
| Store rating | Highest adult rating on both stores (18+ / Mature) |
| Store age signal | Call Apple Declared Age Range and Google Play Age Signals at sign-up; any signal under 18 ends onboarding |
| No signal | Facial age estimation at sign-up; estimates under 25 escalate to ID verification |
| Self-declared DOB | Collected, never trusted alone |
| Ongoing | Reports of a suspected minor trigger immediate restriction and ID check; confirmed minors are removed and their data deleted except what law requires preserving |
| Use limits | Age signals are used only for age gating, never for ads or analytics (Google's Age Signals terms prohibit it) |

Because BEEF is not directed to children and blocks minors, COPPA's full parental-consent regime should not apply; counsel must confirm, and the FTC's February 2026 policy statement on age-verification data should shape how age-check data is handled.

**Campus note:** some first-year students are 17. Campus marketing targets students 18+, and orientation-week events must check age at the door.

## Identity verification and screening

The sources required a background check before in-person meetings and implied it made meetings safe. Industry experience says otherwise: Match Group's Garbo partnership, which gave Tinder users public-records checks on matches, ended after disputes over funding and over public-records quality. Background checks miss unreported behavior and can create false confidence. BEEF therefore treats screening as one layer among several and never as a safety badge.

| Check | Tier | Vendor approach | What is stored |
| --- | --- | --- | --- |
| Selfie liveness + profile photo match | V1 | Identity vendor (Persona primary; Stripe Identity or Onfido as fallback) | Pass/fail, timestamp, vendor reference |
| Government ID + liveness | V2 | Same vendor | Verified first name, DOB, document country, pass/fail; never the ID image |
| Duplicate-person check | V1+ | Vendor face dedupe across BEEF accounts | Vendor-side template only |
| Sex-offender registry screen | V3 | Public registry data via screening vendor, matched on verified name + DOB | Clear / review / match |
| Criminal background check | V3 optional | Consumer reporting agency, run only with the user's own written authorization, FCRA-compliant adverse-action flow | Pass/fail against BEEF policy; report held by the CRA |
| Re-verification | All | V2 every 24 months; V3 registry screen every 12 months; selfie re-check on suspicious login |  |

**Policy for a screening match:** registry match → account removed. Criminal-check policy (which offenses exclude, look-back period) must be written with counsel to satisfy FCRA and fair-chance considerations and applied consistently.

### Required Texas disclosures

Texas Business and Commerce Code chapter 106 (Internet Dating Safety Act) applies to online dating services offered to Texas residents. Counsel should confirm BEEF is covered given its romantic intent mode; this spec assumes it is.

- If BEEF does **not** run criminal background checks on every member before they can communicate, it must say so in bold capital letters of at least 12-point type on its website.
- If it **does**, it must disclose that fact clearly and conspicuously and publish statements that background checks are not foolproof, may give a false sense of security, are not a perfect safety solution, and cover only publicly available convictions.
- All providers must publish a list of safety-awareness measures.
- Penalty: up to $250 per Texas member per violation period.

Because V3 screening is not run on *every* member before *any* communication, BEEF ships the "does not conduct" disclosure, plus the safety-awareness page, and adds an in-app version at sign-up and on the Level 4 intro screen.

## In-person safety and emergency response

Level 4 is where harm can happen, so it has the most layers. Partner venues add staff, cameras, crowds, and a check-in record that a private meeting never has.

### Before the meet

- Both players at V3. First two meets between a given pair only at Safe-Beef Certified venues (Spec 05 defines certification).
- Safety brief (60 s) on first Level 4, plus Texas disclosures.
- **Meet plan:** BEEF records who, where, and when automatically from the booking. The user can share it with up to 3 emergency contacts.
- Optional referee or chaperone friend joins the event thread.

### During the meet

- **Check-in prompts** at start time and at the planned end. No response within 15 minutes of the end → push, then SMS to the user; still nothing → alert emergency contacts with the meet plan (user-configured).
- **Live location share** with chosen contacts for the event duration only; auto-stops at event end.
- **Shield button** (always visible in Level 4 screens): *I'm OK* · *Get me out* (fake incoming call, notify venue staff discreetly) · *Alert my contacts* · *Emergency*.
- **Emergency** opens the native dialer with 911 pre-filled and, in parallel, triggers a professional dispatch service (Noonlight-style API) that relays location and the meet plan to emergency responders and can act even if the user cannot speak. Match Group's Tinder integration with Noonlight is the established precedent for this model.
- The source design that sent the last three chat images to BEEF servers "for subpoenas" is removed: it adds no immediate safety and collects sensitive content without need. Reported conversations are instead preserved through the report flow.

### After the meet

- Both players privately rate *Did you feel safe?* (never shown to the other). Two "no" ratings across different people triggers review.
- Venue staff can flag a player from the partner portal.
- Post-meet report window stays open for 30 days.

## Moderation, community rules, enforcement

Trash talk is the brand; harassment is a ban. The community guidelines draw the line with examples, and every surface that carries user content has filter, report, block, and a published contact, which app-store user-generated-content rules also require.

### Community guidelines (headline rules)

| Allowed | Not allowed |
| --- | --- |
| Competitive trash talk about play ("you're getting cooked") | Slurs, attacks on protected traits, threats, doxxing |
| Flirting under romantic intent with mutual interest | Unsolicited sexual content; any sexual content in platonic threads; sexual content anywhere in public surfaces |
| Physical challenges within listed titles | Dangerous dares: heights, traffic, fire, water, weapons, substances, stunts on vehicles |
| Recording yourself and consenting opponents | Recording or streaming bystanders, venue staff, or opponents without consent |
| Rematches and rivalries | Repeated unwanted challenges after a decline or block (harassment) |
|  | Moving matches to private locations before the first-meet rule is met; solicitation; scams; money requests |

### Enforcement ladder

The source's 3-strike rule is kept for low-severity violations, with severity overriding the count.

| Severity | Examples | Action |
| --- | --- | --- |
| Low | Mild insult outside play context, spammy challenges | Warning → 24 h mute → 7-day restriction |
| Medium | Targeted harassment, unsolicited explicit image, cheating | 7-day suspension → permanent ban on repeat |
| High | Threats, stalking, doxxing, NCII, violence at a meet, fraud | Immediate suspension pending review; ban; law-enforcement referral where appropriate |
| Critical | CSAM, child exploitation, credible threat to life | Immediate removal and ban, NCMEC report, evidence preservation |

Bans attach to the verified identity, not only the account, so a banned person cannot re-verify a new account.

### Reporting and review targets

| Queue | First action | Resolution |
| --- | --- | --- |
| Critical | 15 min, 24/7 | 1 h |
| High (incl. NCII) | 1 h, 24/7 | 24 h (NCII removal under 48 h is a legal maximum) |
| Medium | 12 h | 72 h |
| Low | 48 h | 7 days |

**Appeals:** every suspension or ban is appealable in-app; reviewed by a different moderator within 7 days; outcome explained in plain language.

**Transparency:** semi-annual public report of reports received, actions taken, and median response times (needed for EU expansion under the Digital Services Act; good practice before that).

## Child safety and intimate-image takedown

Two federal laws set hard requirements that the sources did not mention.

### CSAM and the REPORT Act

The REPORT Act (Public Law 118-59, May 2024) expanded mandatory CyberTipline reporting to apparent child sex trafficking and enticement, extended the preservation period for reported content from 90 days to one year, and raised penalties for failing to report.

- Hash-match every uploaded image and video (chat, profile, Level 3, streams, clips) against known-CSAM hash sets before delivery.
- Confirmed or apparent CSAM: block, ban, report to NCMEC's CyberTipline, preserve in the evidence vault for at least 1 year, restrict access to two named roles.
- Reviewers never re-view hash-matched content; wellness program and exposure limits for reviewers.
- Even with an 18+ platform, minors may try to join or be depicted; the age and minor-report flows in Age assurance feed this process.

### Nonconsensual intimate images and the TAKE IT DOWN Act

The FTC began enforcing Section 3 on May 19, 2026. Covered platforms, which include social, messaging, and gaming services with user content, must offer a plain-language way to request removal of intimate images shared without consent and must remove the image and known identical copies within 48 hours of a valid request. Penalties can reach about $53,000 per violation, and FTC guidance says the process must also work for people without an account.

| Requirement | BEEF implementation |
| --- | --- |
| Easy request process | In-app *Report intimate image* option on every media item and profile, plus a public web form at /takedown that needs no account |
| Valid request contents | Form collects location of content, statement of non-consent, contact info, signature |
| 48-hour removal | Ticket created with ID and clock; auto-hide on receipt for high-confidence matches; human confirmation; removal before 48 h |
| Known identical copies | Perceptual hash of removed item added to a block list; existing copies purged; future uploads blocked |
| Tracking | Requester gets a ticket number and status updates; both requester and poster are notified of the outcome |
| Records | Every request, timestamp, action, and reviewer logged for audit |

## Privacy and biometric law

BEEF processes sensitive data by design: precise location, face geometry for liveness, sexual-orientation-adjacent intent settings, and government ID results. The privacy program must be built before beta, not retrofitted. Items in this section are from general knowledge of these statutes and must be confirmed by counsel.

| Law | Why it applies | Key duties for BEEF |
| --- | --- | --- |
| Texas Data Privacy and Security Act | Texas launch market; BEEF processes sensitive data | Opt-in consent for sensitive data (precise location, biometrics, sex life); privacy notice; data protection assessments; opt-out of targeted ads and sale |
| Texas CUBI (biometric identifiers) | Liveness and face match use face geometry | Notice and consent before capture; no sale; destroy within the statutory window after purpose ends; vendor contract to match |
| Illinois BIPA | Any Illinois user, even before an Illinois launch | Written policy with retention schedule; written release before capture; private right of action makes this the highest-cost biometric risk; geofence or full compliance |
| California CCPA / CPRA | National availability | Notice at collection, right to delete and correct, limit use of sensitive data, "Do Not Sell or Share" |
| Washington My Health My Data | Possibly, if fitness or health inferences are drawn from Level 3 | Avoid collecting health data; Level 3 stores counts and times, not health inferences |
| GDPR / UK GDPR | International phase only | DPIA, lawful basis, DPO, EU representative, data transfer mechanism |

### Product requirements that follow

- Consent screens for location, biometrics, and intent, separate and unbundled, recorded with timestamps.
- Self-service data download and delete (24 h to start export, 30 days to complete deletion; source's 24 h "purge" was not realistic for backups).
- Retention schedule: chats 2 years, inactive accounts deleted after 24 months, Level 3 raw video 30 days unless saved, location never stored beyond the session except as H3 cell on bookings.
- No sale of personal data; partner analytics are aggregated with a minimum group size of 25 users (no individual-level venue reports).
- Vendor DPAs with every processor; identity vendor bound to the biometric retention schedule.

## Gaming, promotions, and app-store rules

### Why Beef Points can never be staked or bought

Gambling law in most US states turns on three elements: consideration (something of value put in), chance, and a prize. The sources proposed wagering points, converting poker chips 1:1 to Beef Points, and redeeming points for real goods; together that is all three elements. The Spec 02 economy removes them: points are never purchasable or staked, and chance-driven games pay XP only.

### Paid tournaments

The Texas Attorney General has opined (GA-0926) that paying an entry fee for a contest that tests skill or speed with no element of chance is likely not a bet under the Penal Code. That is helpful but not universal: states differ, some games in the catalog include chance, and Apple requires real-money gaming apps to be licensed, geo-restricted, and free on the store. **Decision:** no paid entry at launch. Tournaments use sponsor- or venue-funded prizes with free entry. Paid skill tournaments require a state-by-state legal memo, geofencing, and store approval before they ship.

### Promotions and sweepstakes

Venue promos ("win a free lane") are promotions; free-entry giveaways must have official rules, eligibility, odds disclosure, and no purchase necessary. Counsel to supply a rules template.

### App-store requirements checklist

| Requirement | Applies because | BEEF response |
| --- | --- | --- |
| UGC safeguards: filter, report, block, published contact | Chat, feed, streams | Built in (Moderation) |
| Sign in with Apple when other social logins offered | Google sign-in offered | Included |
| Account deletion in app | All apps with accounts | Profile → Safety center → Delete |
| Simulated gambling rating | Hold'em, Blackjack Duel | Already adult-rated; XP only |
| Mini-apps and downloaded code (Apple guideline 4.7) | Only if games are delivered as downloaded HTML5 | Not used: games ship in the binary |
| In-app purchase for digital goods | Subscriptions, cosmetics | Store billing; physical venue services and deposits use Stripe |
| External purchase links (US) | Optional web checkout | Allowed in the US storefront following Epic v. Apple; the commission Apple may charge is still being litigated, so keep this behind a flag |
| Tracking transparency and attribution | Paid acquisition | ATT prompt only if needed; AdAttributionKit for attribution |
| Location and background use justification | Level 4 live share | Foreground by default; background only during an event with explicit opt-in |

## Legal checklist and counsel questions

### Documents required before beta

- [ ] Terms of Service (arbitration, assumption of risk for Level 3 and 4, no-wagering clause, venue disclaimer)
- [ ] Privacy Policy and Texas, California, Illinois-specific notices
- [ ] Biometric data policy and retention schedule (public)
- [ ] Community Guidelines and enforcement policy
- [ ] Texas ch. 106 dating-safety disclosures and safety-awareness page
- [ ] TAKE IT DOWN request page and internal SOP
- [ ] NCMEC reporting SOP and CyberTipline registration
- [ ] Law-enforcement request policy and emergency disclosure process
- [ ] Venue Master Services Agreement (Spec 05), venue data-processing terms
- [ ] Promotions and sweepstakes official-rules template
- [ ] Physical-challenge waiver and liability acknowledgment
- [ ] DPAs with every vendor; FCRA documents if the optional background check ships

### Questions for counsel

1. Is BEEF an "online dating service provider" under Texas ch. 106 for users who never select romantic intent? (Spec assumes yes, platform-wide.)
2. Do BEEF's developer-side duties under SB 2420 require anything beyond consuming the store age signals and rating accurately?
3. Is the 18+ design plus age assurance enough to stay outside COPPA's parental-consent regime?
4. Venue-funded redemptions: do expiring Beef Points raise any state unclaimed-property or gift-card issues?
5. Liability allocation between BEEF and venues for injuries during Level 4 (axe throwing especially).
6. Trademark clearance for BEEF and the provisional lexicon.

### Sources

- [Amended COPPA Rule (Federal Register)](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) and [Davis Polk on April 2026 enforcement](https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect)
- [Texas SB 2420 tracker](https://texasdatalaw.com/tracker/sb-2420/) and [InfoLawGroup on the Supreme Court denial](https://www.infolawgroup.com/insights/2026/7/7/supreme-court-clears-the-way-texass-app-store-accountability-act-is-now-enforceable)
- [Google Play Age Signals global rollout](https://betanews.com/article/google-play-age-signals-api-global-rollout/) and [Apple age assurance tools](https://www.helpnetsecurity.com/?p=358863)
- [Garbo ends Match Group partnership (TechCrunch)](https://techcrunch.com/?p=2584559)
- [Tex. Bus. & Com. Code §106.005](https://texas.public.law/statutes/tex._bus._&_com._code_section_106.005) and [SB 488 bill analysis](https://capitol.texas.gov/tlodocs/82R/analysis/html/SB00488S.htm)
- [Match Group and Noonlight partnership](https://fool.com/investing/2020/01/23/match-group-brings-safety-tools-to-online-dating.aspx)
- [REPORT Act explained (Wilson Sonsini)](https://wsgr.com/en/insights/new-minor-safety-obligations-for-online-services-report-act-expands-child-sexual-exploitation-reporting-requirements.html)
- [FTC begins enforcing TAKE IT DOWN](https://www.ftc.gov/news-events/news/press-releases/2026/05/ftc-begins-enforcing-take-it-down-act) and [Orrick on enforcement](https://www.orrick.com/en/Insights/2026/06/Nonconsensual-Intimate-Images-Online-Take-It-Down-Act-Enforcement-In-Full-Swing)
- [Texas AG Opinion GA-0926](https://www.oag.state.tx.us/opinions/greg-abbott/ga-0926)
- [Epic v. Apple commission status](https://macdailynews.com/2026/08/14/u-s-supreme-court-clears-path-for-app-store-commission-showdown-as-apple-must-defend-its-rates-in-lower-court/)
