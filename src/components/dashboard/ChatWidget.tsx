import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Maximize2, ChevronDown, Send } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { getAvatarConfig, getAgentName, getAgentAvatarId } from "@/lib/avatars";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const ChatWidget = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { messages, addMessage, isWidgetOpen, setWidgetOpen } = useChat();
  const [hasOpened, setHasOpened] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentName = getAgentName();
  const avatar = getAvatarConfig(getAgentAvatarId());
  const isOnChat = location.pathname === "/dashboard/chat";

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (isWidgetOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isWidgetOpen]);

  if (isOnChat) return null;

  const handleOpen = () => {
    if (isMobile) {
      navigate("/dashboard/chat");
      return;
    }
    setWidgetOpen(true);
    setHasOpened(true);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    addMessage("user", text);
    setInput("");

    // Simulated reply
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

  // Bubble only
  if (!isWidgetOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        aria-label={`Chat with ${agentName}`}
      >
        <MessageCircle className="h-6 w-6" />
        {!hasOpened && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background animate-pulse" />
        )}
      </button>
    );
  }

  // Slide-up panel (desktop only)
  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[380px] h-[500px] rounded-2xl border border-border bg-card flex flex-col overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.4)]"
      style={{ animation: "slideUp 200ms ease-out" }}
    >
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div
          className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: avatar.bg }}
        >
          {avatar.display}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{agentName}</p>
          <p className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Online
          </p>
        </div>
        <button
          onClick={() => { setWidgetOpen(false); navigate("/dashboard/chat"); }}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Full-page chat"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => setWidgetOpen(false)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Minimize"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div
                className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 mt-0.5"
                style={{ background: avatar.bg }}
              >
                {avatar.display}
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
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
              className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 mt-0.5"
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
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-background shrink-0">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Message ${agentName}...`}
          className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-9 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;
