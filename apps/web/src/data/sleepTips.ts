export interface SleepTip {
  id: number;
  title: string;
  content: string;
  category: "environment" | "habits" | "timing" | "mindset" | "stimulus-control";
}

export const sleepTips: SleepTip[] = [
  // Environment tips
  {
    id: 1,
    title: "Keep it cool",
    content:
      "Your bedroom temperature should be between 16-18°C (60-65°F). A cool room helps your body naturally lower its core temperature, which signals it's time to sleep.",
    category: "environment",
  },
  {
    id: 2,
    title: "Embrace the dark",
    content:
      "Make your bedroom as dark as possible. Even small amounts of light can disrupt melatonin production. Consider blackout curtains or a sleep mask.",
    category: "environment",
  },
  {
    id: 3,
    title: "Create a quiet sanctuary",
    content:
      "Reduce noise disruptions with earplugs, a white noise machine, or a fan. Consistent background sounds can mask sudden noises that might wake you.",
    category: "environment",
  },
  {
    id: 4,
    title: "Reserve your bed for sleep",
    content:
      "Your bed should be associated with sleep (and intimacy) only. Working, watching TV, or scrolling on your phone in bed weakens the mental connection between bed and sleep.",
    category: "stimulus-control",
  },

  // Habit tips
  {
    id: 5,
    title: "Mind your caffeine",
    content:
      "Caffeine has a half-life of 5-6 hours. That afternoon coffee at 3pm still has half its caffeine in your system at 9pm. Try to avoid caffeine after midday.",
    category: "habits",
  },
  {
    id: 6,
    title: "Limit alcohol before bed",
    content:
      "While alcohol might help you fall asleep, it disrupts sleep quality and REM cycles later in the night. Try to avoid alcohol within 3 hours of bedtime.",
    category: "habits",
  },
  {
    id: 7,
    title: "Watch your evening meals",
    content:
      "Large or heavy meals close to bedtime can cause discomfort and disrupt sleep. If you're hungry before bed, opt for a light snack rather than a full meal.",
    category: "habits",
  },
  {
    id: 8,
    title: "Create a wind-down routine",
    content:
      "Spend 30-60 minutes before bed doing relaxing activities. Reading, gentle stretching, or a warm bath can signal to your body that it's time to sleep.",
    category: "habits",
  },
  {
    id: 9,
    title: "Limit screen time",
    content:
      "The blue light from phones, tablets, and computers can suppress melatonin. Try to avoid screens for at least 30 minutes before bed, or use night mode settings.",
    category: "habits",
  },

  // Timing tips
  {
    id: 10,
    title: "Wake up at the same time daily",
    content:
      "Consistency is key for your body clock. Waking at the same time every day, even on weekends, helps regulate your circadian rhythm and improve sleep quality.",
    category: "timing",
  },
  {
    id: 11,
    title: "Get morning light exposure",
    content:
      "Expose yourself to bright light within an hour of waking. This helps reset your circadian rhythm and makes it easier to feel sleepy at the right time.",
    category: "timing",
  },
  {
    id: 12,
    title: "Time your exercise right",
    content:
      "Regular exercise improves sleep quality, but intense workouts too close to bedtime can be stimulating. Aim to finish vigorous exercise at least 3-4 hours before bed.",
    category: "timing",
  },
  {
    id: 13,
    title: "Avoid long naps",
    content:
      "If you need to nap, keep it under 30 minutes and before 3pm. Longer or later naps can reduce your sleep drive and make it harder to fall asleep at night.",
    category: "timing",
  },

  // Stimulus control tips
  {
    id: 14,
    title: "Only go to bed when sleepy",
    content:
      "If you're not feeling sleepy, don't go to bed just because it's 'bedtime'. Wait until you feel genuinely drowsy to strengthen the bed-sleep association.",
    category: "stimulus-control",
  },
  {
    id: 15,
    title: "Get up if you can't sleep",
    content:
      "If you've been lying awake for more than 20 minutes, get up and do something relaxing in dim light. Return to bed only when you feel sleepy again.",
    category: "stimulus-control",
  },
  {
    id: 16,
    title: "Don't clock-watch",
    content:
      "Watching the clock when you can't sleep increases anxiety and makes it harder to drift off. Turn your clock away or remove it from view.",
    category: "stimulus-control",
  },

  // Mindset tips
  {
    id: 17,
    title: "Release the day's worries",
    content:
      "Try writing down tomorrow's tasks or concerns before bed. Getting thoughts out of your head and onto paper can help quiet a racing mind.",
    category: "mindset",
  },
  {
    id: 18,
    title: "Practice relaxation techniques",
    content:
      "Deep breathing, progressive muscle relaxation, or meditation can help calm your nervous system and prepare your body for sleep.",
    category: "mindset",
  },
  {
    id: 19,
    title: "Accept that some nights will be harder",
    content:
      "Occasional poor sleep is normal. Worrying about not sleeping often makes it worse. Trust that your body will catch up when it needs to.",
    category: "mindset",
  },
  {
    id: 20,
    title: "Celebrate small wins",
    content:
      "Sleep improvement takes time. Notice and appreciate gradual improvements rather than expecting overnight changes. Progress, not perfection.",
    category: "mindset",
  },
];

// Get today's tip based on day of year
export function getDailyTip(): SleepTip {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const tipIndex = dayOfYear % sleepTips.length;
  return sleepTips[tipIndex]!;
}

// Get a random tip
export function getRandomTip(): SleepTip {
  const randomIndex = Math.floor(Math.random() * sleepTips.length);
  return sleepTips[randomIndex]!;
}

// Get tips by category
export function getTipsByCategory(category: SleepTip["category"]): SleepTip[] {
  return sleepTips.filter((tip) => tip.category === category);
}
