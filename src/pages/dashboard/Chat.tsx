import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownRight, Send } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { getAvatarConfig, getAgentName, getAgentAvatarId } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TypingIndicator = () => (
  <div className="flex gap-1 items-center px-4 py-3">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

const Chat = () => {
  const navigate = useNavigate();
  const { messages, addMessage, setWidgetOpen } = useChat();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentName = getAgentName();
  const avatar = getAvatarConfig(getAgentAvatarId());

  // Close widget on mount
  useEffect(() => {
    setWidgetOpen(false);
  }, [setWidgetOpen]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    addMessage("user", text);
    setInput("");

    setTimeout(() => setIsTyping(true), 1500);
    setTimeout(() => {
      setIsTyping(false);
      addMessage("assistant", "I'm still being provisioned — I'll be fully online shortly! In the meantime, I'm already scanning your website and preparing insights. 🔍");
    }, 2500);
    setTimeout(() => setIsTyping(true), 3500);
    setTimeout(() => {
      setIsTyping(false);
      addMessage("assistant", "Anything specific you'd like me to focus on first?");
    }, 4500);
  };

  const handleMinimize = () => {
    setWidgetOpen(true);
    navigate("/dashboard");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.12)-theme(spacing.12))] sm:h-[calc(100vh-theme(spacing.12))]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-base font-bold"
            style={{ background: avatar.bg }}
          >
            {avatar.display}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{agentName}</h1>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Online
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleMinimize} className="hidden sm:flex">
          <ArrowDownRight className="h-4 w-4 mr-1" />
          Minimize to Widget
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5"
                style={{ background: avatar.bg }}
              >
                {avatar.display}
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary/10 text-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5"
              style={{ background: avatar.bg }}
            >
              {avatar.display}
            </div>
            <div className="bg-secondary rounded-xl">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 pt-4 border-t border-border mt-4">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Message ${agentName}...`}
          className="flex-1 h-11"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Chat;
