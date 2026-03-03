import { Settings as SettingsIcon } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const SettingsPage = () => (
  <EmptyState
    icon={SettingsIcon}
    heading="Settings"
    description="Configure your agent, API keys, budget controls, and team. Your settings will be available after setup."
  />
);

export default SettingsPage;
