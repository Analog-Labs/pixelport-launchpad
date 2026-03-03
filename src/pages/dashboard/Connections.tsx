import { Link } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const Connections = () => (
  <EmptyState
    icon={Link}
    heading="Connections"
    description="Manage your integrations — Slack, social platforms, email, and more. Connect your first tool to get started."
  />
);

export default Connections;
