import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getAgentName } from "@/lib/avatars";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (role: "user" | "assistant", content: string) => void;
  isWidgetOpen: boolean;
  setWidgetOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

function makeInitialMessages(): ChatMessage[] {
  const name = getAgentName();
  return [
    {
      id: "init-1",
      role: "assistant",
      content: `Hey! 👋 I'm ${name}, your Chief of Staff. I'm currently getting set up — analyzing your website and preparing your first insights.`,
      timestamp: new Date(),
    },
    {
      id: "init-2",
      role: "assistant",
      content: "In the meantime, feel free to ask me anything about your marketing strategy, competitors, or content ideas.",
      timestamp: new Date(),
    },
  ];
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(makeInitialMessages);
  const [isWidgetOpen, setWidgetOpen] = useState(false);

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, timestamp: new Date() },
    ]);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, addMessage, isWidgetOpen, setWidgetOpen }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
