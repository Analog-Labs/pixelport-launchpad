import { Search } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const Competitors = () => (
  <EmptyState
    icon={Search}
    heading="Competitor Intelligence"
    description="Monitor competitor activity and get proactive alerts. Add competitors during onboarding to get started."
  />
);

export default Competitors;
