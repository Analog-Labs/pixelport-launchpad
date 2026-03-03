import { Brain } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const Vault = () => (
  <EmptyState
    icon={Brain}
    heading="Knowledge Vault"
    description="Your agent's memory — brand voice, competitors, audience insights. This builds automatically as your agent works."
  />
);

export default Vault;
