import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

interface Props {
  data: {
    company_name: string;
    company_url: string;
    agent_name: string;
  };
  onChange: (patch: Partial<Props["data"]>) => void;
  onNext: () => void | Promise<void>;
  submitting: boolean;
  error?: string;
}

const StepCompanyInfo = ({ data, onChange, onNext, submitting, error }: Props) => {
  const valid =
    data.company_name.trim().length >= 2 &&
    data.agent_name.trim().length >= 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Tell us about your company</h2>
          <p className="text-sm text-muted-foreground">We'll use this to personalize your experience</p>
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="company_name">Company name</Label>
        <Input
          id="company_name"
          placeholder="e.g. Acme Corp"
          value={data.company_name}
          onChange={(e) => onChange({ company_name: e.target.value })}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
          maxLength={100}
        />
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="company_url">Website URL</Label>
        <Input
          id="company_url"
          placeholder="https://yourcompany.com"
          value={data.company_url}
          onChange={(e) => onChange({ company_url: e.target.value })}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
          maxLength={255}
        />
      </div>

      {/* Agent name */}
      <div className="space-y-2">
        <Label htmlFor="agent_name">Chief of Staff name</Label>
        <Input
          id="agent_name"
          placeholder="Luna"
          value={data.agent_name}
          onChange={(e) => onChange({ agent_name: e.target.value })}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
          maxLength={60}
        />
      </div>

      <Button
        className="w-full shimmer-btn text-primary-foreground font-semibold"
        disabled={!valid || submitting}
        onClick={onNext}
      >
        {submitting ? "Saving company details..." : "Continue to Strategy"}
        {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default StepCompanyInfo;
