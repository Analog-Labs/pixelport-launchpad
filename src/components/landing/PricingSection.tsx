import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$299",
    highlighted: false,
    features: [
      "1 AI employee (Chief of Staff)",
      "Default LLM keys included",
      "AgentMail email",
      "Text + image content",
      "Competitor monitoring",
      "Daily reports",
      "Dedicated VM",
      "Standard support",
    ],
    cta: "Start Free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Pro",
    price: "$999",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "3 AI employees (Chief of Staff + 2 specialists)",
      "Default + BYO LLM keys",
      "AgentMail email",
      "Text + images + video content",
      "Competitor monitoring",
      "Daily & weekly reports",
      "Dedicated VM",
      "Priority support",
      "Workflow automation",
      "Advanced analytics",
    ],
    cta: "Start Free",
    ctaVariant: "default" as const,
  },
  {
    name: "Enterprise",
    price: "$3,000+",
    highlighted: false,
    features: [
      "Unlimited agents",
      "Default + BYO LLM keys",
      "AgentMail + Gmail/Outlook",
      "Full media suite",
      "Competitor monitoring",
      "Custom reporting",
      "Custom infrastructure",
      "Dedicated support + SLA",
      "Custom integrations",
      "Compliance features (audit log, RBAC)",
    ],
    cta: "Book a Demo",
    ctaVariant: "outline" as const,
  },
];

const PricingSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="pricing" className="relative section-container">
      {/* Ambient glow behind Pro card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[400px] bg-primary/6 rounded-full blur-[120px]" />
      </div>

      <div ref={ref} className={`relative scroll-fade-in ${isVisible ? "visible" : ""}`}>
        <div className="text-center mb-16">
          <h2 className="section-title mb-4">Simple pricing. No surprises.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl p-6 transition-all isolate ${
                plan.highlighted
                  ? "border-2 border-primary/50 bg-card shadow-[0_0_40px_rgba(212,168,83,0.12)] md:-mt-4 md:mb-0"
                  : "border border-border bg-card"
              }`}
            >
              {plan.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold">
                  {plan.badge}
                </Badge>
              )}
              <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
              <p className="text-3xl font-black text-foreground mb-1">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </p>
              <ul className="space-y-2.5 my-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check size={16} className="text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.ctaVariant}
                className={`w-full ${plan.highlighted ? "shimmer-btn text-primary-foreground font-semibold" : "border-border hover:border-primary/40"}`}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
