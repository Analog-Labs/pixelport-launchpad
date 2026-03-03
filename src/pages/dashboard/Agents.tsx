import { Bot } from "lucide-react";

const Agents = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="rounded-xl bg-primary/10 p-4 mb-4"><Bot className="h-8 w-8 text-primary" /></div>
    <h1 className="text-2xl font-bold text-foreground">Your Agents</h1>
    <p className="text-muted-foreground mt-2 max-w-md">Configure and manage your AI marketing agents here.</p>
  </div>
);

export default Agents;
