# SleepAssured MVP Scope Document

## Overview & Vision

SleepAssured is a digital therapeutics platform delivering evidence-based Cognitive Behavioral Therapy for Insomnia (CBT-I), starting with Sleep Restriction Therapy (SRT). The platform integrates with WHOOP wearables to provide objective sleep data while capturing subjective user experiences.

**Mission:** Make effective insomnia treatment accessible through technology-assisted sleep restriction therapy.

**V1 Goal:** Validate core therapeutic value with a web-based MVP that guides users through their first 4-8 weeks of sleep restriction therapy.

---

## V1 Feature List

### 1. Authentication

| Feature | Acceptance Criteria |
|---------|---------------------|
| Email/password signup | User can create account with email, password (min 8 chars), and name |
| Email/password login | User can login with valid credentials |
| JWT authentication | Access tokens expire in 15 minutes, refresh tokens in 7 days |
| Password security | Passwords hashed with bcrypt (cost factor 12) |
| Session management | User can logout, invalidating refresh token |

### 2. Onboarding

| Feature | Acceptance Criteria |
|---------|---------------------|
| Account creation | User completes signup with consent checkbox for data processing |
| ISI Questionnaire | User completes 7-question Insomnia Severity Index (scored 0-28) |
| Baseline score storage | ISI score saved with timestamp for progress tracking |
| WHOOP connection prompt | User presented with option to connect WHOOP after ISI |
| Onboarding completion | User marked as onboarded after ISI + WHOOP decision |

### 3. Sleep Diary

| Feature | Acceptance Criteria |
|---------|---------------------|
| WHOOP auto-population | Sleep times, duration, efficiency, recovery auto-filled from WHOOP |
| Manual entry fallback | User can enter all fields manually if no WHOOP data |
| Subjective quality rating | User rates sleep quality 1-10 |
| Mood tracking | User selects mood from predefined options |
| Notes field | Free-text field for sleep-related notes |
| Source tracking | Each entry tagged as `manual`, `whoop`, or `hybrid` |
| Edit capability | User can edit entries for current day and previous day |

### 4. Sleep Restriction Therapy

| Feature | Acceptance Criteria |
|---------|---------------------|
| Week 1 data collection | System requires 7 diary entries before calculating sleep window |
| Initial window calculation | Sleep window = average total sleep time (minimum 5 hours) |
| Fixed wake time | User sets consistent wake time; bedtime calculated backwards |
| Weekly efficiency calculation | Sleep efficiency = (total sleep / time in bed) × 100 |
| Adherence tracking | System tracks if user followed prescribed window (±30 min tolerance) |
| Window adjustment rules | ≥90% efficiency: +15 min; 85-89%: no change; <85%: -15 min |
| Safety bounds | Time in bed never < 5 hours or > 9 hours |
| Templated messages | Static messages guide users through adjustments |

### 5. Dashboard

| Feature | Acceptance Criteria |
|---------|---------------------|
| Current sleep window | Displays prescribed bedtime and wake time prominently |
| Sleep efficiency trend | Line or bar chart showing weekly efficiency (last 4 weeks) |
| Adherence percentage | Shows % of nights user followed prescribed window |
| WHOOP recovery display | Shows latest recovery score from WHOOP |
| Quick log button | One-tap access to log previous night's sleep |
| Week indicator | Shows current therapy week (Week 1, Week 2, etc.) |

### 6. WHOOP Integration

| Feature | Acceptance Criteria |
|---------|---------------------|
| OAuth 2.0 flow | Standard authorization code flow with PKCE |
| Required scopes | `read:sleep`, `read:recovery`, `read:profile` |
| Token storage | Access and refresh tokens stored securely (encrypted at rest) |
| Data polling | Background job fetches WHOOP data every 4 hours |
| Connection status | User can see WHOOP connection status |
| Disconnect option | User can disconnect WHOOP from settings |
| Graceful degradation | App fully functional without WHOOP connection |

---

## V2 Backlog

| Feature | Description | Reason to Defer |
|---------|-------------|-----------------|
| AI Coaching | OpenAI-powered personalized recommendations | Adds complexity, cost, requires safety review |
| iOS App | Native iPhone application | Web-first validates core therapeutic value |
| Android App | Native Android application | Web-first validates core therapeutic value |
| Push Notifications | Bedtime reminders, morning prompts | Requires mobile app or browser notification setup |
| WHOOP Webhooks | Real-time data sync | Polling sufficient at MVP scale |
| Stimulus Control | Education module on bedroom environment | Focus on core SRT loop first |
| Cognitive Restructuring | Thought challenging exercises | Advanced CBT-I module |
| Advanced Titration | Complex adjustment algorithms | Simple ±15 min rules sufficient for V1 |
| Apple Health | Import data from Apple Watch, iPhone | Requires native iOS app |
| Other Wearables | Fitbit, Oura, Garmin integration | WHOOP partnership focus for V1 |
| MHRA Compliance | UK medical device certification | Post-validation regulatory phase |
| Progress Reports | Exportable PDF reports for clinicians | Nice-to-have after core validated |
| Multi-language | Localization support | English-only for V1 |

---

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite or Next.js (SSR optional)
- **Styling:** Tailwind CSS
- **Charts:** Recharts or Chart.js
- **State:** React Context + React Query
- **Forms:** React Hook Form + Zod validation

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js + TypeScript
- **API Style:** REST with JSON
- **Validation:** Zod schemas

### Database
- **Primary:** PostgreSQL 15
- **ORM:** Prisma
- **Migrations:** Prisma Migrate

### Authentication
- **Strategy:** JWT (access + refresh tokens)
- **Password Hashing:** bcrypt
- **Token Storage:** HTTP-only cookies (refresh), memory (access)

### Infrastructure (V1)
- **Hosting:** Railway, Render, or Vercel
- **Database:** Managed PostgreSQL
- **No Redis required** (session handled via JWT)

---

## Data Models (Simplified)

### User
```
id: UUID
email: string (unique)
password_hash: string
name: string
created_at: timestamp
onboarding_completed: boolean
whoop_connected: boolean
```

### ISIAssessment
```
id: UUID
user_id: UUID (FK)
score: integer (0-28)
responses: JSON
completed_at: timestamp
```

### SleepDiary
```
id: UUID
user_id: UUID (FK)
date: date
time_in_bed: timestamp
time_out_of_bed: timestamp
sleep_onset_latency: integer (minutes)
wake_after_sleep_onset: integer (minutes)
total_sleep_time: integer (minutes)
sleep_efficiency: decimal
subjective_quality: integer (1-10)
mood: enum
notes: text
source: enum (manual, whoop, hybrid)
whoop_recovery_score: integer (nullable)
created_at: timestamp
updated_at: timestamp
```

### SleepWindow
```
id: UUID
user_id: UUID (FK)
week_number: integer
prescribed_bedtime: time
prescribed_wake_time: time
time_in_bed_allowed: integer (minutes)
started_at: date
ended_at: date (nullable)
sleep_efficiency: decimal (calculated)
adherence_percentage: decimal
adjustment_applied: enum (increase, decrease, none)
```

### WHOOPConnection
```
id: UUID
user_id: UUID (FK)
whoop_user_id: string
access_token: string (encrypted)
refresh_token: string (encrypted)
token_expires_at: timestamp
connected_at: timestamp
last_synced_at: timestamp
```

---

## Success Metrics

### Primary (Therapeutic Efficacy)
- **ISI Score Reduction:** ≥6 point decrease from baseline at Week 8
- **Sleep Efficiency Improvement:** Achieve ≥85% weekly average
- **Therapy Completion Rate:** % of users reaching Week 4

### Secondary (Engagement)
- **Daily Diary Completion:** ≥80% of nights logged
- **Adherence Rate:** ≥70% of nights within prescribed window
- **WHOOP Connection Rate:** % of users connecting wearable
- **Weekly Retention:** Week-over-week active user retention

### Technical
- **API Response Time:** p95 < 500ms
- **Uptime:** 99.5% availability
- **Error Rate:** < 1% of API requests

---

## Out of Scope for V1

- No AI-generated content or recommendations
- No mobile applications
- No real-time notifications
- No multi-user or clinician portal
- No billing or subscription management
- No HIPAA compliance (UK focus initially)
- No integration with EHR systems
