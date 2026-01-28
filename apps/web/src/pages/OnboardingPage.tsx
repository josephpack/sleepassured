import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

// ISI Questions
const ISI_QUESTIONS = [
  {
    id: 1,
    question: "Difficulty falling asleep",
    description: "How difficult has it been to fall asleep?",
  },
  {
    id: 2,
    question: "Difficulty staying asleep",
    description: "How often do you wake up during the night?",
  },
  {
    id: 3,
    question: "Problems waking up too early",
    description: "Do you wake up earlier than you would like?",
  },
  {
    id: 4,
    question: "Sleep pattern satisfaction",
    description: "How satisfied are you with your current sleep pattern?",
  },
  {
    id: 5,
    question: "Daytime functioning",
    description: "How noticeable are your sleep problems to others?",
  },
  {
    id: 6,
    question: "Quality of life impact",
    description: "How worried are you about your current sleep problems?",
  },
  {
    id: 7,
    question: "Daily interference",
    description:
      "How much do your sleep problems interfere with your daily functioning?",
  },
];

const ISI_OPTIONS = [
  { value: 0, label: "None" },
  { value: 1, label: "Mild" },
  { value: 2, label: "Moderate" },
  { value: 3, label: "Severe" },
  { value: 4, label: "Very Severe" },
];

type OnboardingStep = "welcome" | "isi" | "whoop" | "waketime" | "complete";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isiResponses, setIsiResponses] = useState<number[]>(
    new Array(7).fill(-1)
  );
  const [isiScore, setIsiScore] = useState<number | null>(null);
  const [targetWakeTime, setTargetWakeTime] = useState("07:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.success("Onboarding complete! Welcome to SleepAssured.");
      navigate("/");
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
          "You're experiencing moderate sleep issues. Our program is designed to help people like you.",
      };
    return {
      level: "Severe insomnia",
      message:
        "You're experiencing significant sleep difficulties. Consider consulting a healthcare provider alongside using our program.",
    };
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {["Welcome", "Assessment", "Connect", "Schedule"].map(
              (label, index) => {
                const steps: OnboardingStep[] = [
                  "welcome",
                  "isi",
                  "whoop",
                  "waketime",
                ];
                const isActive = steps.indexOf(currentStep) >= index;
                const isCurrent = steps[index] === currentStep;
                return (
                  <div
                    key={label}
                    className={`flex-1 text-center text-sm ${
                      isCurrent
                        ? "font-semibold text-primary"
                        : isActive
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </div>
                );
              }
            )}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${
                  (["welcome", "isi", "whoop", "waketime", "complete"].indexOf(
                    currentStep
                  ) /
                    4) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Step: Welcome */}
        {currentStep === "welcome" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Welcome to SleepAssured, {user?.name?.split(" ")[0]}!
              </CardTitle>
              <CardDescription>
                Let's set up your personalized sleep improvement program
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium">What to expect:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-primary" />
                    <span>
                      A quick assessment to understand your sleep patterns
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-primary" />
                    <span>
                      Optional WHOOP integration for objective sleep tracking
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-primary" />
                    <span>
                      Personalized sleep schedule based on CBT-I principles
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-primary" />
                    <span>Daily diary and weekly progress tracking</span>
                  </li>
                </ul>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  By continuing, you agree to use this app as a wellness tool,
                  not a replacement for professional medical advice. If you have
                  serious sleep concerns, please consult a healthcare provider.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => setCurrentStep("isi")}
              >
                Get Started
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step: ISI Assessment */}
        {currentStep === "isi" && (
          <Card>
            <CardHeader>
              <CardTitle>Sleep Assessment</CardTitle>
              <CardDescription>
                Please rate the severity of your sleep problems over the past 2
                weeks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {ISI_QUESTIONS.map((q, index) => (
                <div key={q.id} className="space-y-3">
                  <div>
                    <Label className="text-base">{q.question}</Label>
                    <p className="text-sm text-muted-foreground">
                      {q.description}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {ISI_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={
                          isiResponses[index] === option.value
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => handleIsiResponse(index, option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep("welcome")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmitIsi}
                disabled={!isIsiComplete || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step: WHOOP Connection */}
        {currentStep === "whoop" && (
          <div className="space-y-4">
            {isiScore !== null && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Your ISI Score: {isiScore}/28
                  </CardTitle>
                  <CardDescription>
                    {getSeverityMessage(isiScore).level}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {getSeverityMessage(isiScore).message}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Connect Your WHOOP (Optional)</CardTitle>
                <CardDescription>
                  Sync your sleep data automatically for better insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WhoopConnect />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep("isi")}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep("waketime")}>
                  {/* Show different text based on connection status */}
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Step: Wake Time */}
        {currentStep === "waketime" && (
          <Card>
            <CardHeader>
              <CardTitle>Set Your Target Wake Time</CardTitle>
              <CardDescription>
                What time do you need to wake up most days? We'll build your
                sleep schedule around this.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="waketime">Wake Time</Label>
                <Input
                  id="waketime"
                  type="time"
                  value={targetWakeTime}
                  onChange={(e) => setTargetWakeTime(e.target.value)}
                  className="max-w-[200px] text-lg"
                />
                <p className="text-sm text-muted-foreground">
                  This should be the time you need to be awake for work, school,
                  or other commitments.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">How CBT-I Works</h4>
                <p className="text-sm text-muted-foreground">
                  We'll start with a calculated bedtime based on your sleep
                  efficiency. As your sleep improves, we'll gradually adjust
                  your schedule to increase time in bed while maintaining
                  quality sleep.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep("whoop")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCompleteOnboarding}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
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
