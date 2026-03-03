import { Star, Lock, CheckCircle } from "lucide-react";

const items = [
  { icon: <Star size={14} />, text: "Built on OpenClaw · 46K+ ⭐" },
  { icon: null, text: "OpenAI · Gemini · Anthropic" },
  { icon: <Lock size={14} />, text: "Isolated infrastructure per customer" },
  { icon: <CheckCircle size={14} />, text: "14-day free trial · No credit card" },
  { icon: null, text: "Slack · LinkedIn · X" },
];

const TrustBar = () => (
  <div className="border-t border-border bg-surface/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {item.icon && <span className="text-primary">{item.icon}</span>}
            {item.text}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TrustBar;
