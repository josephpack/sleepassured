# SleepAssured User Flows

## Overview

This document describes the core user journeys for SleepAssured V1 MVP. Each flow includes the steps, decision points, and expected outcomes.

---

## 1. New User Onboarding Flow

### Entry Point
User lands on marketing page or direct signup link.

### Flow Steps

```
┌─────────────────────────────────────────────────────────────────┐
│  1. LANDING PAGE                                                │
│     • Value proposition                                         │
│     • "Get Started" CTA                                         │
│     └─→ Signup Page                                             │
├─────────────────────────────────────────────────────────────────┤
│  2. SIGNUP PAGE                                                 │
│     • Email input                                               │
│     • Password input (with requirements shown)                  │
│     • Name input                                                │
│     • Consent checkbox (data processing, terms)                 │
│     • "Create Account" button                                   │
│     └─→ Email verification (V2) or direct to ISI               │
├─────────────────────────────────────────────────────────────────┤
│  3. ISI QUESTIONNAIRE                                           │
│     • Introduction explaining the assessment                    │
│     • 7 questions (one per screen or scrollable)                │
│     • Progress indicator                                        │
│     • "Next" / "Back" navigation                                │
│     • Final "Submit" button                                     │
│     └─→ ISI Results                                             │
├─────────────────────────────────────────────────────────────────┤
│  4. ISI RESULTS                                                 │
│     • Score displayed (0-28)                                    │
│     • Severity interpretation:                                  │
│       - 0-7: No clinically significant insomnia                 │
│       - 8-14: Subthreshold insomnia                             │
│       - 15-21: Clinical insomnia (moderate)                     │
│       - 22-28: Clinical insomnia (severe)                       │
│     • Explanation of what this means                            │
│     • "Continue" button                                         │
│     └─→ WHOOP Connection                                        │
├─────────────────────────────────────────────────────────────────┤
│  5. WHOOP CONNECTION                                            │
│     • Explanation of WHOOP integration benefits                 │
│     • "Connect WHOOP" button (primary)                          │
│     • "Skip for now" link (secondary)                           │
│     │                                                           │
│     ├─→ [Connect] → WHOOP OAuth Flow → Success → Sleep Goal     │
│     └─→ [Skip] → Sleep Goal Setup                               │
├─────────────────────────────────────────────────────────────────┤
│  6. SLEEP GOAL SETUP                                            │
│     • Set desired wake time (for scheduling)                    │
│     • Brief explanation of sleep restriction                    │
│     • "Start My Program" button                                 │
│     └─→ Dashboard (Week 1 - Data Collection)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Points
- **ISI Score < 8:** Show message that sleep restriction may not be needed, but allow continuation
- **WHOOP Connection:** Optional, app works without it

### Success Criteria
- User completes ISI assessment
- User reaches dashboard
- User understands they need 7 nights of data before therapy begins

---

## 2. Daily Sleep Diary Flow

### Entry Point
User opens app or clicks "Log Last Night" from dashboard.

### Flow Steps

```
┌─────────────────────────────────────────────────────────────────┐
│  1. DIARY ENTRY START                                           │
│     • Date shown (defaults to last night)                       │
│     • If WHOOP connected: "Fetching your sleep data..."         │
│     └─→ Diary Form                                              │
├─────────────────────────────────────────────────────────────────┤
│  2. DIARY FORM (WHOOP Connected)                                │
│     Pre-filled from WHOOP:                                      │
│     • Time got into bed                                         │
│     • Time tried to sleep                                       │
│     • Time woke up                                              │
│     • Time got out of bed                                       │
│     • Total sleep time                                          │
│     • Sleep efficiency                                          │
│     • Recovery score                                            │
│                                                                 │
│     User completes:                                             │
│     • Subjective quality (1-10 slider)                          │
│     • Mood (emoji/icon selection)                               │
│     • Notes (optional text field)                               │
│     • "Did you follow your sleep window?" (after Week 1)        │
│     └─→ Confirmation                                            │
├─────────────────────────────────────────────────────────────────┤
│  2. DIARY FORM (Manual Entry)                                   │
│     User enters all fields:                                     │
│     • What time did you get into bed?                           │
│     • What time did you try to fall asleep?                     │
│     • How long did it take to fall asleep? (minutes)            │
│     • How many times did you wake up?                           │
│     • Total time awake during night? (minutes)                  │
│     • What time did you finally wake up?                        │
│     • What time did you get out of bed?                         │
│     • Subjective quality (1-10)                                 │
│     • Mood selection                                            │
│     • Notes (optional)                                          │
│     └─→ Confirmation                                            │
├─────────────────────────────────────────────────────────────────┤
│  3. CONFIRMATION                                                │
│     • Summary of entry                                          │
│     • Calculated sleep efficiency shown                         │
│     • Encouraging message based on data                         │
│     • "Done" button                                             │
│     └─→ Dashboard                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Templated Messages (Examples)
- **Good efficiency (≥85%):** "Great night! Your sleep efficiency was [X]%. Keep following your schedule."
- **Low efficiency (<85%):** "Sleep efficiency was [X]%. This is normal during sleep restriction. Consistency is key."
- **Missed window:** "Looks like bedtime was outside your window. Try to stick to [prescribed time] tonight."

### Edge Cases
- **No WHOOP data available:** Show manual form with message
- **Editing previous entry:** Allow edits for today and yesterday only
- **Already logged today:** Show existing entry with "Edit" option

---

## 3. Weekly Review Flow

### Entry Point
Triggered after 7 days of diary entries (or manually from dashboard).

### Flow Steps

```
┌─────────────────────────────────────────────────────────────────┐
│  1. WEEKLY SUMMARY                                              │
│     • Week number (e.g., "Week 2 Complete")                     │
│     • Average sleep efficiency for the week                     │
│     • Adherence percentage                                      │
│     • Comparison to previous week (if applicable)               │
│     • "View Details" expands daily breakdown                    │
│     └─→ Adjustment Decision                                     │
├─────────────────────────────────────────────────────────────────┤
│  2. ADJUSTMENT DECISION (System Calculated)                     │
│     Based on sleep efficiency:                                  │
│                                                                 │
│     ≥90% Efficiency:                                            │
│     • "Great progress! We're adding 15 minutes to your window"  │
│     • New bedtime shown                                         │
│                                                                 │
│     85-89% Efficiency:                                          │
│     • "Good consistency! Let's keep your current window"        │
│     • Same bedtime confirmed                                    │
│                                                                 │
│     <85% Efficiency:                                            │
│     • "Let's tighten your window by 15 minutes"                 │
│     • New bedtime shown (unless at 5hr minimum)                 │
│     └─→ New Week Preview                                        │
├─────────────────────────────────────────────────────────────────┤
│  3. NEW WEEK PREVIEW                                            │
│     • Your new sleep window: [bedtime] - [wake time]            │
│     • Reminder of the goal                                      │
│     • Tips for the coming week                                  │
│     • "Start Week [N]" button                                   │
│     └─→ Dashboard (new week active)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Safety Checks
- Never reduce below 5 hours time in bed
- Never increase above 9 hours time in bed
- If user at minimum and still <85%, show supportive message without further reduction

---

## 4. WHOOP Connection Flow

### Entry Point
From onboarding, settings, or dashboard prompt.

### Flow Steps

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CONNECTION PROMPT                                           │
│     • Benefits of connecting WHOOP                              │
│     • What data will be accessed                                │
│     • "Connect WHOOP" button                                    │
│     └─→ WHOOP OAuth                                             │
├─────────────────────────────────────────────────────────────────┤
│  2. WHOOP OAUTH (External)                                      │
│     • Redirect to WHOOP authorization page                      │
│     • User logs into WHOOP (if not already)                     │
│     • User approves requested scopes                            │
│     • Redirect back to SleepAssured                             │
│     └─→ Success or Error                                        │
├─────────────────────────────────────────────────────────────────┤
│  3A. CONNECTION SUCCESS                                         │
│     • "WHOOP Connected!" confirmation                           │
│     • Initial data sync begins                                  │
│     • "Your recent sleep data is being imported"                │
│     • "Continue" button                                         │
│     └─→ Previous context (onboarding or settings)               │
├─────────────────────────────────────────────────────────────────┤
│  3B. CONNECTION ERROR                                           │
│     • "Connection failed" message                               │
│     • Reason if available                                       │
│     • "Try Again" button                                        │
│     • "Skip for now" link                                       │
│     └─→ Retry or Skip                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Disconnect Flow
```
Settings → WHOOP Connection → "Disconnect" → Confirm → Tokens deleted
```

---

## 5. Settings & Account Flow

### Entry Point
Settings icon/menu from dashboard.

### Available Settings

```
┌─────────────────────────────────────────────────────────────────┐
│  SETTINGS MENU                                                  │
│                                                                 │
│  Profile                                                        │
│  ├── Name                                                       │
│  ├── Email (display only)                                       │
│  └── Change Password                                            │
│                                                                 │
│  Sleep Schedule                                                 │
│  ├── Target Wake Time                                           │
│  └── View Current Window (read-only)                            │
│                                                                 │
│  Integrations                                                   │
│  ├── WHOOP: [Connected/Not Connected]                           │
│  └── Connect / Disconnect button                                │
│                                                                 │
│  Data & Privacy                                                 │
│  ├── Export My Data                                             │
│  ├── Delete My Account                                          │
│  └── Privacy Policy link                                        │
│                                                                 │
│  Support                                                        │
│  ├── Help Center link                                           │
│  ├── Contact Support                                            │
│  └── App Version                                                │
│                                                                 │
│  [Logout Button]                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Change Password Flow
```
Current Password → New Password → Confirm New Password → Save → Success message
```

### Delete Account Flow
```
Delete Account → Warning message → Type "DELETE" to confirm → Account deleted → Redirect to landing
```

---

## 6. Dashboard States

### Week 1 (Data Collection)

```
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD - DATA COLLECTION MODE                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Week 1: Building Your Baseline                          │   │
│  │  Log 7 nights of sleep to calculate your starting window │   │
│  │                                                          │   │
│  │  Progress: ████████░░░░░░░░░░░░  4/7 nights              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Log Last Night]  (prominent button)                           │
│                                                                 │
│  Recent Entries:                                                │
│  • Mon Jan 20 - 6h 12m sleep, 78% efficiency                    │
│  • Sun Jan 19 - 5h 45m sleep, 72% efficiency                    │
│  • Sat Jan 18 - 7h 02m sleep, 81% efficiency                    │
│  • Fri Jan 17 - 5h 30m sleep, 69% efficiency                    │
│                                                                 │
│  WHOOP Recovery: 67% (if connected)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Week 2+ (Active Therapy)

```
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD - ACTIVE THERAPY                                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Your Sleep Window                                       │   │
│  │  ┌─────────────┐     ┌─────────────┐                     │   │
│  │  │  Bedtime    │     │  Wake Time  │                     │   │
│  │  │   11:30 PM  │ →→→ │   6:00 AM   │                     │   │
│  │  └─────────────┘     └─────────────┘                     │   │
│  │  Time in bed: 6h 30m                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Log Last Night]                                               │
│                                                                 │
│  This Week (Week 3)          Last Week                          │
│  ├─ Efficiency: 84%          ├─ Efficiency: 79%                 │
│  ├─ Adherence: 5/6 nights    ├─ Adherence: 6/7 nights           │
│  └─ Avg Sleep: 5h 52m        └─ Adjustment: +15 min             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Sleep Efficiency Trend                                  │   │
│  │  100%|                                                   │   │
│  │   90%|          ▄▄                                       │   │
│  │   80%|     ▄▄   ██   ▄▄                                  │   │
│  │   70%| ▄▄  ██   ██   ██                                  │   │
│  │   60%| ██  ██   ██   ██                                  │   │
│  │      └─W1──W2───W3───W4──                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  WHOOP Recovery Today: 72%                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error States

### Common Error Handling

| Error | User Message | Action |
|-------|--------------|--------|
| Network offline | "You're offline. Your entry will be saved when you reconnect." | Queue locally |
| WHOOP sync failed | "Couldn't fetch WHOOP data. You can enter manually." | Show manual form |
| Session expired | "Please log in again." | Redirect to login |
| Server error | "Something went wrong. Please try again." | Retry button |

---

## Navigation Structure

```
├── Landing Page (unauthenticated)
├── Login
├── Signup
│   └── Onboarding
│       ├── ISI Assessment
│       ├── ISI Results
│       ├── WHOOP Connection
│       └── Sleep Goal Setup
│
└── Main App (authenticated)
    ├── Dashboard (home)
    ├── Sleep Diary
    │   ├── New Entry
    │   └── Edit Entry
    ├── Weekly Review
    ├── History (list of past entries)
    └── Settings
        ├── Profile
        ├── Sleep Schedule
        ├── Integrations
        ├── Data & Privacy
        └── Support
```
