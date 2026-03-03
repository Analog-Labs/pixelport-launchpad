import { MessageCircle } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const Chat = () => (
  <EmptyState
    icon={MessageCircle}
    heading="Chat with Luna"
    description="Your Chief of Staff will be available here after onboarding."
    buttonText="Complete Onboarding"
  />
);

export default Chat;
