import { FileText } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const Content = () => (
  <EmptyState
    icon={FileText}
    heading="Content Pipeline"
    description="Your content drafts, approvals, and published posts will appear here. Complete onboarding to start creating."
  />
);

export default Content;
