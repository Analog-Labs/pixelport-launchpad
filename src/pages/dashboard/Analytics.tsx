import { BarChart3 } from "lucide-react";

const Analytics = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="rounded-xl bg-primary/10 p-4 mb-4"><BarChart3 className="h-8 w-8 text-primary" /></div>
    <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
    <p className="text-muted-foreground mt-2 max-w-md">Performance metrics and insights from your agents will show up here.</p>
  </div>
);

export default Analytics;
