import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  submitISIAssessment,
  updateUserProfile,
} from "@/features/onboarding/api/onboarding";
import { WhoopConnect } from "@/components/WhoopConnect";
import { getWhoopStatus } from "@/features/whoop/api/whoop";
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

  // Poll WHOOP connection status when on the whoop step
  useEffect(() => {
    if (currentStep !== "whoop") return;
    let cancelled = false;

    async function checkStatus() {
      try {
        const status = await getWhoopStatus();
        if (!cancelled) setWhoopConnected(status.connected);
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
        level: "No clinically significant insomnia",
        message:
          "Your sleep appears healthy. SleepAssured can help you maintain good sleep habits.",
      };
    if (score <= 14)
      return {
        level: "Subthreshold insomnia",
        message:
          "You have some sleep difficulties. CBT-I techniques can help improve your sleep quality.",
      };
    if (score <= 21)
      return {
        level: "Moderate insomnia",
        message:
          "You're experiencing moderate sleep issues. Our programme is designed to help people like you.",
      };
    return {
      level: "Severe insomnia",
      message:
        "You're experiencing significant sleep difficulties. Consider consulting a healthcare provider alongside using our programme.",
    };
  };

  const currentStepIndex = STEP_CONFIG.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen bg-background sa-mesh-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8 sa-animate-in">
          <div className="flex justify-between items-center mb-4 px-2">
            {STEP_CONFIG.map((step, index) => {
              const isActive = currentStepIndex >= index;
              const isCurrent = step.key === currentStep;
              const isDone = currentStepIndex > index;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isCurrent
                        ? "bg-primary text-primary-foreground sa-glow scale-105"
                        : isDone
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium transition-colors ${
                      isCurrent
                        ? "text-primary"
                        : isActive
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
          <div className="h-1 bg-muted rounded-full overflow-hidden mx-2">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(currentStepIndex / (STEP_CONFIG.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Step: Welcome */}
        {currentStep === "welcome" && (
          <Card className="sa-card sa-animate-scale overflow-hidden">
            <div className="sa-gradient-dusk">
              <CardHeader className="text-center pb-4 pt-8">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center sa-animate-float">
                  <Moon className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="font-display text-2xl tracking-tight">
                  Welcome, {user?.name?.split(" ")[0]}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  Let's set up your personalised sleep improvement programme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pb-6">
                <div className="rounded-xl bg-card/60 backdrop-blur-sm border border-border/50 p-5 space-y-3">
                  <h3 className="font-semibold text-sm">What to expect:</h3>
                  <ul className="space-y-3">
                    {[
                      "A quick assessment to understand your sleep patterns",
                      "Automatic sleep tracking via your WHOOP",
                      "Personalised sleep schedule based on CBT-I principles",
                      "Weekly progress tracking and AI coaching",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 sa-animate-in" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                        <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground/70 leading-relaxed px-1">
                  By continuing, you agree to use this app as a wellness tool,
                  not a replacement for professional medical advice. If you have
                  serious sleep concerns, please consult a healthcare provider.
                </p>
              </CardContent>
              <CardFooter className="pb-6">
                <Button
                  className="w-full rounded-xl h-12 text-[15px] font-semibold"
                  onClick={() => setCurrentStep("isi")}
                >
                  Get Started
                  <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
              </CardFooter>
            </div>
          </Card>
        )}

        {/* Step: ISI Assessment */}
        {currentStep === "isi" && (
          <Card className="sa-card sa-animate-scale overflow-hidden">
            <CardHeader>
              <CardTitle className="font-display text-xl tracking-tight">Sleep Assessment</CardTitle>
              <CardDescription>
                Please rate the severity of your sleep problems over the past 2
                weeks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-7">
              {ISI_QUESTIONS.map((q, index) => (
                <div key={q.id} className="space-y-3 sa-animate-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <div>
                    <Label className="text-[15px] font-semibold">{q.question}</Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
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
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card border-border/60 text-foreground hover:border-primary/30 hover:bg-primary/4"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-between pt-6">
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
            </CardFooter>
          </Card>
        )}

        {/* Step: WHOOP Connection */}
        {currentStep === "whoop" && (
          <div className="space-y-4">
            {isiScore !== null && (
              <Card className="sa-card sa-animate-in overflow-hidden border-primary/15">
                <div className="sa-gradient-dusk">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/12 border border-primary/15 flex items-center justify-center">
                        <span className="font-display text-lg font-bold text-primary">{isiScore}</span>
                      </div>
                      <div>
                        <CardTitle className="font-display text-lg tracking-tight">
                          ISI Score: {isiScore}/28
                        </CardTitle>
                        <CardDescription>
                          {getSeverityMessage(isiScore).level}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {getSeverityMessage(isiScore).message}
                    </p>
                  </CardContent>
                </div>
              </Card>
            )}

            <Card className="sa-card sa-animate-in sa-stagger-1 overflow-hidden">
              <CardHeader>
                <CardTitle className="font-display text-xl tracking-tight">Connect Your WHOOP</CardTitle>
                <CardDescription>
                  WHOOP is required to automatically track your sleep data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WhoopConnect />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep("isi")} className="rounded-xl">
                  <ChevronLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                {whoopConnected && (
                  <Button onClick={() => setCurrentStep("waketime")} className="rounded-xl h-11 px-6">
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1.5" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Step: Wake Time */}
        {currentStep === "waketime" && (
          <Card className="sa-card sa-animate-scale overflow-hidden">
            <CardHeader>
              <CardTitle className="font-display text-xl tracking-tight">Set Your Target Wake Time</CardTitle>
              <CardDescription>
                What time do you need to wake up most days? We'll build your
                sleep schedule around this.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="waketime" className="font-semibold">Wake Time</Label>
                <Input
                  id="waketime"
                  type="time"
                  value={targetWakeTime}
                  onChange={(e) => setTargetWakeTime(e.target.value)}
                  className="max-w-[200px] text-lg rounded-xl h-12 font-display font-semibold text-center"
                />
                <p className="text-sm text-muted-foreground">
                  This should be the time you need to be awake for work, school,
                  or other commitments.
                </p>
              </div>

              <div className="rounded-xl sa-gradient-dusk border border-primary/8 p-5">
                <h4 className="font-semibold text-sm mb-2">How CBT-I Works</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We'll start with a calculated bedtime based on your sleep
                  efficiency. As your sleep improves, we'll gradually adjust
                  your schedule to increase time in bed while maintaining
                  quality sleep.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-4">
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
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
