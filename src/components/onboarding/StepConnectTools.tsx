import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket, Clock, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  agentName: string;
  error?: string;
  onBack: () => void;
  onLaunch: () => void;
}

const StepConnectTools = ({ agentName, error, onBack, onLaunch }: Props) => {
  const [slackClicked, setSlackClicked] = useState(false);
  const { toast } = useToast();

  const handleSlack = () => {
    toast({
      title: "Coming soon!",
      description: "Slack integration coming soon! You can connect later from the Connections page.",
    });
    setSlackClicked(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Link className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Connect your tools</h2>
          <p className="text-sm text-muted-foreground">Optional — you can always do this later</p>
        </div>
      </div>

      {/* Slack Card */}
      <div className="rounded-xl border border-[hsla(38,60%,58%,0.15)] bg-[hsl(240_14%_8%)] p-6">
        <div className="flex items-center gap-3 mb-3">
          {/* Slack logo */}
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
            <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
            <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
            <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
          </svg>
          <h3 className="text-lg font-semibold text-foreground">Connect Slack</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your Chief of Staff will send updates, content drafts, and reports directly to your Slack workspace.
        </p>
        <Button
          variant="outline"
          disabled={slackClicked}
          onClick={handleSlack}
          className={slackClicked ? "opacity-60" : "bg-foreground text-background hover:bg-foreground/90"}
        >
          {slackClicked ? (
            <>
              <Clock className="mr-1.5 h-4 w-4" /> Coming Soon
            </>
          ) : (
            "Connect Slack"
          )}
        </Button>
        {!slackClicked && (
          <p className="text-xs text-muted-foreground mt-3">
            Your agent's first message: "Hey team, I'm {agentName || "Luna"} — your new Chief of Staff. Here's what I'm working on today."
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can always connect tools later from your dashboard.
      </p>

      {/* What happens next */}
      <div className="rounded-xl border-2 border-dashed border-primary/30 p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">After you complete setup:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✅ Your Chief of Staff starts scanning your website</li>
          <li>✅ First competitor analysis begins automatically</li>
          <li>✅ Your first content draft arrives within ~30 minutes</li>
          <li>✅ A proposed KPI plan lands in your inbox</li>
        </ul>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 shimmer-btn text-primary-foreground font-semibold text-base py-5" onClick={onLaunch}>
          🚀 Launch My Agent
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

export default StepConnectTools;
