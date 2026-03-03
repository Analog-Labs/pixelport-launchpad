import { Settings as SettingsIcon } from "lucide-react";

const SettingsPage = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="rounded-xl bg-primary/10 p-4 mb-4"><SettingsIcon className="h-8 w-8 text-primary" /></div>
    <h1 className="text-2xl font-bold text-foreground">Settings</h1>
    <p className="text-muted-foreground mt-2 max-w-md">Manage your account, team, integrations, and billing.</p>
  </div>
);

export default SettingsPage;
