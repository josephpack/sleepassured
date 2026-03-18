import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  submitISIAssessment,
  updateUserProfile,
} from "@/features/onboarding/api/onboarding";
import { WhoopConnect } from "@/components/WhoopConnect";
import { AppleHealthConnect } from "@/components/AppleHealthConnect";
import { getWhoopStatus } from "@/features/whoop/api/whoop";
import { getProviderStatus } from "@/features/providers/api";
import { isNativeIOS } from "@/features/providers/apple-health/healthkit";
import { ChevronLeft, ChevronRight, Check, Loader2, Moon, Sparkles, Activity, Clock } from "lucide-react";

// ISI Questions — each with context-appropriate labels (0–4 scoring preserved)
const ISI_QUESTIONS = [
  {
    id: 1,
    question: "Difficulty falling asleep",
    description: "How difficult has it been to fall asleep?",
    options: [
      { value: 0, label: "Not at all" },
      { value: 1, label: "Mildly" },
      { value: 2, label: "Moderately" },
      { value: 3, label: "Very" },
      { value: 4, label: "Extremely" },
    ],
  },
  {
    id: 2,
    question: "Difficulty staying asleep",
    description: "How often do you wake up during the night?",
    options: [
      { value: 0, label: "Never" },
      { value: 1, label: "Rarely" },
      { value: 2, label: "Sometimes" },
      { value: 3, label: "Often" },
      { value: 4, label: "Always" },
    ],
  },
  {
    id: 3,
    question: "Problems waking up too early",
    description: "Do you wake up earlier than you would like?",
    options: [
      { value: 0, label: "Never" },
      { value: 1, label: "Rarely" },
      { value: 2, label: "Sometimes" },
      { value: 3, label: "Often" },
      { value: 4, label: "Always" },
    ],
  },
  {
    id: 4,
    question: "Sleep pattern satisfaction",
    description: "How satisfied are you with your current sleep pattern?",
    options: [
      { value: 0, label: "Very satisfied" },
      { value: 1, label: "Satisfied" },
      { value: 2, label: "Neutral" },
      { value: 3, label: "Dissatisfied" },
      { value: 4, label: "Very dissatisfied" },
    ],
  },
  {
    id: 5,
    question: "Daytime functioning",
    description: "How noticeable are your sleep problems to others?",
    options: [
      { value: 0, label: "Not at all" },
      { value: 1, label: "Barely" },
      { value: 2, label: "Somewhat" },
      { value: 3, label: "Very" },
      { value: 4, label: "Extremely" },
    ],
  },
  {
    id: 6,
    question: "Quality of life impact",
    description: "How worried are you about your current sleep problems?",
    options: [
      { value: 0, label: "Not at all" },
      { value: 1, label: "A little" },
      { value: 2, label: "Somewhat" },
      { value: 3, label: "Very" },
      { value: 4, label: "Extremely" },
    ],
  },
  {
    id: 7,
    question: "Daily interference",
    description:
      "How much do your sleep problems interfere with your daily functioning?",
    options: [
      { value: 0, label: "Not at all" },
      { value: 1, label: "A little" },
      { value: 2, label: "Somewhat" },
      { value: 3, label: "Much" },
      { value: 4, label: "Very much" },
    ],
  },
];

type OnboardingStep = "welcome" | "isi" | "whoop" | "waketime" | "complete";

const STEP_CONFIG = [
  { key: "welcome" as const, label: "Welcome", icon: Moon },
  { key: "isi" as const, label: "Assessment", icon: Sparkles },
  { key: "whoop" as const, label: "Connect", icon: Activity },
  { key: "waketime" as const, label: "Schedule", icon: Clock },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

  // If returning from WHOOP OAuth, resume on the whoop step
  const initialStep: OnboardingStep =
    searchParams.has("whoop_connected") || searchParams.has("whoop_error")
      ? "whoop"
      : "welcome";
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [isiResponses, setIsiResponses] = useState<number[]>(
    new Array(7).fill(-1)
  );
  const [isiScore, setIsiScore] = useState<number | null>(null);
  const [targetWakeTime, setTargetWakeTime] = useState("07:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [appleHealthConnected, setAppleHealthConnected] = useState(false);
  const anyDeviceConnected = whoopConnected || appleHealthConnected;

  // Poll connection status when on the device step
  useEffect(() => {
    if (currentStep !== "whoop") return;
    let cancelled = false;

    async function checkStatus() {
      try {
        const [whoopStatus, providerStatus] = await Promise.all([
          getWhoopStatus(),
          getProviderStatus(),
        ]);
        if (cancelled) return;
        setWhoopConnected(whoopStatus.connected);
        const ah = providerStatus.providers.find((p) => p.slug === "apple_health");
        setAppleHealthConnected(ah?.connected ?? false);
      } catch {
        // ignore
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentStep]);

  const handleIsiResponse = (questionIndex: number, value: number) => {
    const newResponses = [...isiResponses];
    newResponses[questionIndex] = value;
    setIsiResponses(newResponses);
  };

  const isIsiComplete = isiResponses.every((r) => r >= 0);

  const handleSubmitIsi = async () => {
    if (!isIsiComplete) return;

    setIsSubmitting(true);
    try {
      const { assessment } = await submitISIAssessment(isiResponses);
      setIsiScore(assessment.score);
      setCurrentStep("whoop");
    } catch (error) {
      console.error("Failed to submit ISI:", error);
      toast.error("Failed to save assessment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setIsSubmitting(true);
    try {
      await updateUserProfile({
        targetWakeTime,
        onboardingCompleted: true,
      });
      await refreshUser();
      toast.success("Onboarding complete! Welcome to SleepAssured.");
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityMessage = (score: number) => {
    if (score <= 7)
      return {
        level: "Your sleep looks healthy",
        message:
          "No major issues here. SleepAssured can help you keep it that way.",
      };
    if (score <= 14)
      return {
        level: "Mild sleep difficulties",
        message:
          "You have some sleep difficulties. This programme can help improve how you sleep.",
      };
    if (score <= 21)
      return {
        level: "Moderate sleep difficulties",
        message:
          "You're experiencing moderate sleep issues. This programme is designed for exactly this.",
      };
    return {
      level: "Significant sleep difficulties",
      message:
        "You're experiencing significant sleep difficulties. Consider consulting a healthcare provider alongside using our programme.",
    };
  };

  const currentStepIndex = STEP_CONFIG.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8 animate-fade-up">
          <div className="flex justify-between items-center mb-4 px-2">
            {STEP_CONFIG.map((step, index) => {
              const isCurrent = step.key === currentStep;
              const isDone = currentStepIndex > index;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isCurrent
                        ? "gradient-primary text-white glow-primary scale-105"
                        : isDone
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      isCurrent
                        ? "text-primary"
                        : isDone
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Connecting line */}
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden mx-2">
            <div
              className="h-full gradient-primary rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(currentStepIndex / (STEP_CONFIG.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Step: Welcome */}
        {currentStep === "welcome" && (
          <div className="glass-card rounded-2xl overflow-hidden animate-scale-in">
            <div className="gradient-card p-6 pt-8 text-center">
              <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center animate-float">
                <Moon className="h-7 w-7 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Welcome, {user?.name?.split(" ")[0]}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 mb-6">
                Let's set up your personalised sleep improvement programme
              </p>

              <div className="rounded-xl bg-muted/30 p-5 text-left space-y-3 mb-6">
                <h3 className="font-semibold text-sm">What to expect:</h3>
                <ul className="space-y-3">
                  {[
                    "A quick assessment to understand your sleep patterns",
                    "Automatic sleep tracking via WHOOP or Apple Health",
                    "Personalised sleep schedule that adjusts as you improve",
                    "Weekly progress tracking and coaching",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                      <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] text-muted-foreground/50 leading-relaxed px-1 mb-6">
                By continuing, you agree to use this app as a wellness tool,
                not a replacement for professional medical advice.
              </p>

              <Button
                className="w-full rounded-xl h-12 text-[15px] font-semibold"
                onClick={() => setCurrentStep("isi")}
              >
                Get Started
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: ISI Assessment */}
        {currentStep === "isi" && (
          <div className="glass-card rounded-2xl overflow-hidden animate-scale-in">
            <div className="p-6">
              <h2 className="font-display text-xl font-semibold tracking-tight mb-1">Sleep Assessment</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Please rate the severity of your sleep problems over the past 2
                weeks
              </p>

              <div className="space-y-6">
                {ISI_QUESTIONS.map((q, index) => (
                  <div key={q.id} className="space-y-2.5 animate-fade-up" style={{ animationDelay: `${index * 0.03}s` }}>
                    <div>
                      <Label className="text-sm font-semibold">{q.question}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {q.description}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {q.options.map((option) => {
                        const isSelected = isiResponses[index] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleIsiResponse(index, option.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 border ${
                              isSelected
                                ? "gradient-primary text-white border-transparent shadow-sm"
                                : "bg-muted/30 border-border/40 text-foreground hover:border-primary/30 hover:bg-primary/5"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-6 mt-6 border-t border-border/30">
                <Button variant="ghost" onClick={() => setCurrentStep("welcome")} className="rounded-xl">
                  <ChevronLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmitIsi}
                  disabled={!isIsiComplete || isSubmitting}
                  className="rounded-xl h-11 px-6"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: WHOOP Connection */}
        {currentStep === "whoop" && (
          <div className="space-y-4">
            {isiScore !== null && (
              <div className="glass-card rounded-2xl overflow-hidden animate-fade-up">
                <div className="gradient-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/12 border border-primary/15 flex items-center justify-center">
                      <span className="font-display text-lg font-bold text-primary">{isiScore}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold tracking-tight">
                        ISI Score: {isiScore}/28
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {getSeverityMessage(isiScore).level}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                    {getSeverityMessage(isiScore).message}
                  </p>
                </div>
              </div>
            )}

            <div className="glass-card rounded-2xl overflow-hidden animate-fade-up stagger-1">
              <div className="p-6">
                <h2 className="font-display text-xl font-semibold tracking-tight mb-1">Connect a Sleep Tracker</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Connect a device to automatically track your sleep data
                </p>

                <WhoopConnect />

                {isNativeIOS() && (
                  <div className="mt-4">
                    <AppleHealthConnect />
                  </div>
                )}

                <div className="flex justify-between pt-5 mt-5 border-t border-border/30">
                  <Button variant="ghost" onClick={() => setCurrentStep("isi")} className="rounded-xl">
                    <ChevronLeft className="h-4 w-4 mr-1.5" />
                    Back
                  </Button>
                  {anyDeviceConnected && (
                    <Button onClick={() => setCurrentStep("waketime")} className="rounded-xl h-11 px-6">
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Wake Time */}
        {currentStep === "waketime" && (
          <div className="glass-card rounded-2xl overflow-hidden animate-scale-in">
            <div className="p-6">
              <h2 className="font-display text-xl font-semibold tracking-tight mb-1">Set Your Target Wake Time</h2>
              <p className="text-sm text-muted-foreground mb-6">
                What time do you need to wake up most days? We'll build your
                sleep schedule around this.
              </p>

              <div className="space-y-3 mb-6">
                <Label htmlFor="waketime" className="font-semibold text-sm">Wake Time</Label>
                <Input
                  id="waketime"
                  type="time"
                  value={targetWakeTime}
                  onChange={(e) => setTargetWakeTime(e.target.value)}
                  className="max-w-[200px] text-lg rounded-xl h-12 font-display font-semibold text-center bg-muted/30 border-border/40"
                />
                <p className="text-xs text-muted-foreground">
                  This should be the time you need to be awake for work, school,
                  or other commitments.
                </p>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/8 p-5 mb-6">
                <h4 className="font-semibold text-sm mb-2">How the programme works</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We'll start with a bedtime based on how much of your time
                  in bed you're actually sleeping. As that improves, we'll
                  gradually give you more time in bed while keeping your
                  sleep solid.
                </p>
              </div>

              <div className="flex justify-between pt-4 border-t border-border/30">
                <Button variant="ghost" onClick={() => setCurrentStep("whoop")} className="rounded-xl">
                  <ChevronLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={handleCompleteOnboarding}
                  disabled={isSubmitting}
                  className="rounded-xl h-11 px-6"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-1.5" />
                  )}
                  Complete Setup
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
