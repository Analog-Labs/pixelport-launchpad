import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

const EmptyState = ({ icon: Icon, heading, description, buttonText = "Get Started", onButtonClick }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="rounded-2xl bg-primary/10 p-4 mb-5">
      <Icon className="h-12 w-12 text-primary" />
    </div>
    <h1 className="text-2xl font-bold text-foreground">{heading}</h1>
    <p className="text-muted-foreground mt-2 max-w-[400px]">{description}</p>
    <Button
      variant="outline"
      className="mt-6 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
      onClick={onButtonClick}
    >
      {buttonText} →
    </Button>
  </div>
);

export default EmptyState;
