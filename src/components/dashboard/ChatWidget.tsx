import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ChatWidget = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/dashboard/chat")}
      className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      aria-label="Chat with Luna"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
};

export default ChatWidget;
