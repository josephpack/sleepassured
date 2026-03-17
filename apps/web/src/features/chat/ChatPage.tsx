import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, BookOpen, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  sendChatMessage,
  getQuickReplies,
  ChatMessage,
  QuickReply,
} from "./api";

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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card/80 backdrop-blur-md sa-animate-in">
        <Button variant="ghost" size="icon" asChild className="shrink-0 h-9 w-9 rounded-xl hover:bg-muted">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
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
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center">
          <span className="text-sm">✦</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto sa-scrollbar">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Curriculum-aware empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4 sa-animate-in">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/12 flex items-center justify-center sa-animate-float">
                  <Moon className="h-7 w-7 text-primary/70" />
                </div>
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
                <div className="flex flex-wrap gap-2 justify-center sa-animate-in sa-stagger-2">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReply(reply)}
                      className="sa-pill"
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
              className={`mb-5 sa-animate-scale ${
                message.role === "user" ? "flex justify-end" : ""
              }`}
              style={{ animationDelay: `${Math.min(index * 0.05, 0.2)}s` }}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] px-4 py-3 ${
                  message.role === "user"
                    ? "sa-bubble-user"
                    : "sa-bubble-assistant"
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
            <div className="mb-5 sa-animate-scale">
              <div className="sa-bubble-assistant inline-flex items-center gap-1.5 px-5 py-4">
                <div className="sa-thinking-dot" />
                <div className="sa-thinking-dot" />
                <div className="sa-thinking-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Persistent conversation starters (shown above input when messages exist) */}
      {messages.length > 0 && quickReplies.length > 0 && (
        <div className="border-t border-border/40 bg-card/60 backdrop-blur-md px-4 pt-2.5 pb-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {quickReplies.map((reply) => (
                <button
                  key={reply.id}
                  onClick={() => handleQuickReply(reply)}
                  disabled={isLoading}
                  className="sa-pill text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {reply.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={`border-t border-border/40 bg-card/80 backdrop-blur-md p-4 pb-3 ${messages.length > 0 && quickReplies.length > 0 ? "border-t-0 pt-2" : ""}`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2.5 bg-muted/60 border border-border/50 rounded-2xl px-4 py-2.5 transition-colors focus-within:border-primary/30 focus-within:bg-muted/80">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your sleep..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent resize-none border-0 focus:ring-0 focus:outline-none text-sm py-1.5 max-h-[120px] placeholder:text-muted-foreground/50"
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
          <p className="text-[11px] text-muted-foreground/60 text-center mt-2 tracking-wide">
            Your sleep coach uses your diary data to give personalised advice
          </p>
        </div>
      </div>
    </div>
  );
}
