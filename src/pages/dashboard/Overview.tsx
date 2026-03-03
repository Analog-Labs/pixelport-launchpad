import { LayoutDashboard } from "lucide-react";

const Overview = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="rounded-xl bg-primary/10 p-4 mb-4"><LayoutDashboard className="h-8 w-8 text-primary" /></div>
    <h1 className="text-2xl font-bold text-foreground">Welcome to PixelPort</h1>
    <p className="text-muted-foreground mt-2 max-w-md">Your AI marketing command center. Start by adding an agent or creating content.</p>
  </div>
);

export default Overview;
