import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, BookOpen, Sparkles } from "lucide-react";
import {
  sendChatMessage,
  getQuickReplies,
  ChatMessage,
  QuickReply,
} from "./api";

function CoachAvatar() {
  return (
    <div className="h-8 w-8 rounded-full bg-primary/12 border border-primary/15 flex items-center justify-center">
      <Sparkles className="h-4 w-4 text-primary" />
    </div>
  );
}

function EmptyStateIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto">
      {/* Warm sparkle/plant motif */}
      <circle cx="32" cy="32" r="28" fill="hsla(16,52%,62%,0.06)" />
      <circle cx="32" cy="32" r="18" fill="hsla(16,52%,62%,0.08)" />
      {/* Sparkle */}
      <path
        d="M32 18 L34 28 L44 30 L34 32 L32 42 L30 32 L20 30 L30 28 Z"
        fill="hsla(16,52%,62%,0.35)"
      />
      {/* Small dots */}
      <circle cx="20" cy="20" r="1.5" fill="hsla(16,40%,72%,0.3)" />
      <circle cx="44" cy="22" r="1" fill="hsla(16,40%,72%,0.25)" />
      <circle cx="46" cy="42" r="1.2" fill="hsla(16,40%,72%,0.2)" />
    </svg>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [weekContext, setWeekContext] = useState<{ weekNumber?: number; topic?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load quick replies on mount
  useEffect(() => {
    async function loadQuickReplies() {
      try {
        const data = await getQuickReplies();
        setQuickReplies(data.quickReplies);
        if (data.context.weekNumber && data.context.topic) {
          setWeekContext({
            weekNumber: data.context.weekNumber,
            topic: data.context.topic,
          });
        }
      } catch (error) {
        console.error("Failed to load quick replies:", error);
        // Fallback quick reply
        setQuickReplies([
          {
            id: "how_did_i_sleep",
            label: "How did I sleep?",
            message: "How did I sleep last night?",
          },
        ]);
      }
    }
    loadQuickReplies();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText ?? inputValue.trim();
    if (!text || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(text, messages);
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I couldn't process that. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (reply: QuickReply) => {
    handleSendMessage(reply.message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 surface-nav animate-fade-in">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg font-semibold tracking-tight">Sleep Coach</h1>
          {/* Week context banner */}
          {weekContext?.weekNumber && weekContext?.topic && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3 shrink-0 text-primary/60" />
              <span className="truncate">
                Week {weekContext.weekNumber}: {weekContext.topic}
              </span>
            </div>
          )}
        </div>
        <CoachAvatar />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4 animate-fade-up">
              <div className="relative mb-6">
                <EmptyStateIllustration />
              </div>
              {weekContext?.weekNumber && weekContext?.topic ? (
                <>
                  <h2 className="font-display text-xl font-semibold mb-2 tracking-tight">
                    Week {weekContext.weekNumber}: {weekContext.topic}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
                    Ask me about this week's focus, your sleep data, or anything
                    that's on your mind about your programme.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-semibold mb-2 tracking-tight">
                    How can I help with your sleep?
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
                    I have access to your sleep data and can help you understand
                    your patterns and progress.
                  </p>
                </>
              )}

              {/* Quick replies in empty state */}
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center animate-fade-up stagger-2">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReply(reply)}
                      className="pill"
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-5 animate-scale-in ${
                message.role === "user" ? "flex justify-end" : ""
              }`}
              style={{ animationDelay: `${Math.min(index * 0.05, 0.2)}s` }}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] px-4 py-3 ${
                  message.role === "user"
                    ? "bubble-user"
                    : "bubble-assistant"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="mb-5 animate-scale-in">
              <div className="bubble-assistant inline-flex items-center gap-1.5 px-5 py-4">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Persistent conversation starters (shown above input when messages exist) */}
      {messages.length > 0 && quickReplies.length > 0 && (
        <div className="border-t border-border/30 bg-card/60 backdrop-blur-md px-4 pt-2.5 pb-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {quickReplies.map((reply) => (
                <button
                  key={reply.id}
                  onClick={() => handleQuickReply(reply)}
                  disabled={isLoading}
                  className="pill text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {reply.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={`border-t border-border/30 surface-nav p-4 pb-3 ${messages.length > 0 && quickReplies.length > 0 ? "border-t-0 pt-2" : ""}`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2.5 bg-muted/40 border border-border/40 rounded-2xl px-4 py-2.5 transition-colors focus-within:border-primary/30 focus-within:bg-muted/60">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your sleep..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent resize-none border-0 focus:ring-0 focus:outline-none text-sm py-1.5 max-h-[120px] placeholder:text-muted-foreground/40"
            />
            <Button
              size="icon"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="shrink-0 rounded-xl h-9 w-9 transition-all disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-2 tracking-wide">
            Your sleep coach uses your diary data to give personalised advice
          </p>
        </div>
      </div>
    </div>
  );
}
