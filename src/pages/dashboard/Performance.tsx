import { BarChart3 } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const Performance = () => (
  <EmptyState
    icon={BarChart3}
    heading="Performance"
    description="Track your content performance, KPIs, and agent activity. Data will appear once your agent starts working."
  />
);

export default Performance;
