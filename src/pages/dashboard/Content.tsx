import { FileText } from "lucide-react";

const Content = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="rounded-xl bg-primary/10 p-4 mb-4"><FileText className="h-8 w-8 text-primary" /></div>
    <h1 className="text-2xl font-bold text-foreground">Content Pipeline</h1>
    <p className="text-muted-foreground mt-2 max-w-md">Your content drafts, scheduled posts, and published pieces will appear here.</p>
  </div>
);

export default Content;
