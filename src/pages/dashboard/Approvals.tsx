import { CheckCircle } from "lucide-react";

const Approvals = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="rounded-xl bg-primary/10 p-4 mb-4"><CheckCircle className="h-8 w-8 text-primary" /></div>
    <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
    <p className="text-muted-foreground mt-2 max-w-md">Review and approve content created by your agents before it goes live.</p>
  </div>
);

export default Approvals;
