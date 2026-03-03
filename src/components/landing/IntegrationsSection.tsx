import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const rows = [
  { label: "Messaging & Workspace", items: ["Slack", "Gmail", "Google Workspace"] },
  { label: "Social", items: ["LinkedIn", "X (Twitter)"] },
  { label: "AI & LLMs", items: ["OpenAI", "Google Gemini", "Anthropic", "xAI"] },
  { label: "Analytics & Tools", items: ["PostHog", "HubSpot", "Salesforce", "Notion"] },
  { label: "Media Generation", items: ["FLUX", "Runway", "Sora", "HeyGen"] },
];

const IntegrationsSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="integrations" className="section-container">
      <div ref={ref} className={`scroll-fade-in ${isVisible ? "visible" : ""}`}>
        <div className="text-center mb-16">
          <h2 className="section-title">Connects to the tools you already use</h2>
        </div>

        <div className="space-y-6 max-w-3xl mx-auto">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{row.label}</p>
              <div className="flex flex-wrap gap-3">
                {row.items.map((item) => (
                  <div
                    key={item}
                    className="px-4 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground transition-all duration-300 hover:text-foreground hover:border-primary/30 hover:shadow-[0_0_10px_rgba(212,168,83,0.06)] cursor-default"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          New integrations shipping monthly.{" "}
          <a href="#" className="text-primary hover:underline">Request yours →</a>
        </p>
      </div>
    </section>
  );
};

export default IntegrationsSection;
