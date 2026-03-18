import { Button } from "@/components/ui/button";
import {
  Clock,
  BookOpen,
  MessageCircle,
  ChevronDown,
  Check,
  X,
} from "lucide-react";

function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
      <span className="text-xl font-bold text-white">SleepAssured</span>
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10" asChild>
          <a href="/login">Log In</a>
        </Button>
        <Button className="bg-white text-primary-950 hover:bg-white/90" asChild>
          <a href="/signup">Sign Up</a>
        </Button>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-primary-950 to-primary-900 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-24 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Retrain your brain to sleep.
        </h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10">
          SleepAssured delivers the most effective treatment for insomnia
          that exists — recommended by the NHS ahead of sleeping pills — as
          a personalised, data-driven programme on your phone.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="bg-white text-primary-950 hover:bg-white/90 text-base px-8" asChild>
            <a href="/signup">Get Started</a>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="text-white hover:text-white/80 hover:bg-white/10 text-base"
            asChild
          >
            <a href="#how-it-works">
              Learn How It Works
              <ChevronDown className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const cards = [
    {
      title: "Sleep hygiene tips",
      description:
        "Dark room, no caffeine, chamomile tea. These aren't wrong — but they don't fix insomnia. They're the equivalent of telling someone with a broken leg to wear comfier shoes.",
    },
    {
      title: "Tracking apps",
      description:
        "Most sleep apps track your sleep and hope for the best. Knowing you slept badly doesn't help you sleep better. Passive monitoring without a plan is just watching the problem.",
    },
    {
      title: "Supplements & medication",
      description:
        "Melatonin, magnesium, sleeping pills — they target symptoms, not the root cause. And with medication, the insomnia returns the moment you stop.",
    },
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why sleep tips don't fix insomnia
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Insomnia isn't caused by a dark room or a wrong pillow. It's a
            learned pattern — your brain has started being alert in bed
            instead of sleepy. Until you address that, nothing else
            will stick.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border bg-card p-6 space-y-3"
            >
              <h3 className="font-semibold text-lg">{card.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const features = [
    {
      icon: Clock,
      title: "Data-driven sleep schedule",
      description:
        "Connect your WHOOP or use a manual diary. We calculate a personalised sleep window based on how much of your time in bed you're actually sleeping, then adjust it weekly as you improve.",
    },
    {
      icon: BookOpen,
      title: "Structured 8-week programme",
      description:
        "Spending less time in bed to rebuild your sleep drive. Retraining your brain to associate bed with sleep. Dealing with the thoughts that keep you awake. Delivered week by week at exactly the right time.",
    },
    {
      icon: MessageCircle,
      title: "AI sleep coach",
      description:
        "Explains the science, validates the difficulty, available 24/7. Like having a knowledgeable friend who genuinely understands sleep — and won't just tell you to drink chamomile tea.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How SleepAssured works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            A proven programme that retrains your body and brain to sleep
            properly — not just another app that tracks the problem.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    {
      label: "Approach",
      other: "Track your sleep and hope for the best",
      ours: "Actively retrain your sleep with a proven programme",
    },
    {
      label: "Personalisation",
      other: "Generic tips (dark room, no caffeine)",
      ours: "Personalised schedule based on your actual data",
    },
    {
      label: "Adaptivity",
      other: "Passive monitoring",
      ours: "Weekly adjustments driven by your progress",
    },
    {
      label: "Evidence base",
      other: "No science behind the approach",
      ours: "Built on 30+ years of clinical research into insomnia treatment",
    },
    {
      label: "Support",
      other: "You're on your own",
      ours: "AI coach that explains the science and supports you",
    },
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Most sleep apps vs SleepAssured
          </h2>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground w-1/6">
                  &nbsp;
                </th>
                <th className="text-left p-4 font-semibold w-5/12">
                  Most sleep apps
                </th>
                <th className="text-left p-4 font-semibold text-primary w-5/12">
                  SleepAssured
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={i < rows.length - 1 ? "border-b" : ""}
                >
                  <td className="p-4 font-medium text-muted-foreground">
                    {row.label}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <span className="flex items-start gap-2">
                      <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      {row.other}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {row.ours}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border p-4 space-y-3">
              <p className="font-medium text-sm">{row.label}</p>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span>{row.other}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{row.ours}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Timeline() {
  const steps = [
    {
      week: "Baseline",
      title: "Track your sleep for a week",
      description:
        "No changes yet. You simply track your sleep honestly — this gives us the data to build your personalised schedule.",
    },
    {
      week: "Weeks 1–2",
      title: "Compressed sleep window",
      description:
        "The tough part. Your sleep window is compressed and you'll feel more tired during the day. That's normal — it's the mechanism working. Sleep pressure is building.",
    },
    {
      week: "Weeks 3–4",
      title: "Sleep consolidates",
      description:
        "You'll notice you're falling asleep faster and waking less. Your sleep is becoming deeper and more solid. The daytime tiredness eases.",
    },
    {
      week: "Weeks 5+",
      title: "Permanent improvement",
      description:
        "Your sleep window gradually expands as efficiency improves. You're sleeping more, sleeping better, and becoming your own sleep expert.",
    },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            What to expect
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            The programme follows a structured path. Here's how the weeks
            typically unfold.
          </p>
        </div>
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div key={step.week} className="flex gap-6">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-primary shrink-0 mt-1.5" />
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>
              {/* Content */}
              <div className="pb-10">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                  {step.week}
                </p>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Evidence() {
  const endorsements = ["NHS", "ACP", "ESRS", "NICE"];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Built on evidence, not trends
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg mb-10">
          The method behind SleepAssured has over 30 years of clinical
          research behind it. It's recommended as the first treatment to
          try for chronic insomnia by:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          {endorsements.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border bg-card px-5 py-2 text-sm font-semibold"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          SleepAssured takes this proven approach and makes it accessible — no
          waiting lists, no referrals, no six-week waits for a clinic
          appointment.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      question: "Is spending less time in bed safe?",
      answer:
        "Yes. This technique is used in NHS sleep clinics worldwide. It temporarily reduces time in bed to rebuild your body's need to sleep — you won't be sleep-deprived beyond what you're already experiencing. However, if you have a condition affected by sleepiness (e.g. epilepsy), or you operate heavy machinery, please consult your GP before starting.",
    },
    {
      question: "How is this different from other sleep apps?",
      answer:
        "Most sleep apps passively track your sleep and offer generic tips. SleepAssured actively retrains your sleep using the same structured method used in NHS sleep clinics. It calculates a personalised sleep schedule from your data, adjusts it weekly, and provides coaching grounded in sleep science.",
    },
    {
      question: "Do I need a WHOOP?",
      answer:
        "A WHOOP band allows automatic sleep tracking, which makes the programme more accurate and convenient. However, you can also use a manual sleep diary — the programme works with both.",
    },
    {
      question: "How long until I see results?",
      answer:
        "Most people notice meaningful improvements within 2–4 weeks. The first week or two can be tough as your body's need to sleep builds up, but this is temporary and a sign the programme is working. By weeks 3–4, your sleep gets deeper and more solid — you'll fall asleep faster and wake less during the night.",
    },
    {
      question: "Will it work for me?",
      answer:
        "This method is effective for the vast majority of people with chronic insomnia — clinical trials show improvement rates of 70–80%. It works by addressing the learned patterns that keep insomnia going, regardless of how it started. If your sleep problems are primarily caused by an untreated medical condition (e.g. sleep apnoea), we'd recommend seeing a specialist first.",
    },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Frequently asked questions
          </h2>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border bg-card"
            >
              <summary className="flex cursor-pointer items-center justify-between p-5 font-medium">
                {item.question}
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-primary-950 to-primary-900 text-white text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to sleep properly again?
        </h2>
        <p className="text-white/80 text-lg mb-8">
          Insomnia isn't something you have to live with. It's a pattern — and
          patterns can be changed.
        </p>
        <Button size="lg" className="bg-white text-primary-950 hover:bg-white/90 text-base px-8" asChild>
          <a href="/signup">Get Started</a>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-6 bg-primary-950 text-white/60 text-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>&copy; {new Date().getFullYear()} SleepAssured. All rights reserved.</p>
        <a href="/login" className="hover:text-white transition-colors">
          Log in
        </a>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Problem />
      <HowItWorks />
      <Comparison />
      <Timeline />
      <Evidence />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
