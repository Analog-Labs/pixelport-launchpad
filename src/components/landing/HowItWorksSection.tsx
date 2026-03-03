import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  { num: "1", title: "Drop your URL", desc: "Paste your website. Your Chief of Staff auto-scans your brand, competitors, audience, and voice." },
  { num: "2", title: "Personalize", desc: "Name your agent, set the tone, pick your goals. Or just keep the defaults — Luna's ready." },
  { num: "3", title: "Connect Slack", desc: "One-click OAuth. Your Chief of Staff sends its first message and starts working immediately." },
];

const HowItWorksSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="how-it-works" className="section-container-tight">
      <div ref={ref} className={`scroll-fade-in ${isVisible ? "visible" : ""}`}>
        <div className="text-center mb-12">
          <h2 className="section-title">Live in 5 minutes</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-8 relative">
          <div className="hidden sm:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-border" />

          {steps.map((s) => (
            <div key={s.num} className="text-center relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-primary text-primary text-xl font-bold mb-4 bg-background relative z-10">
                {s.num}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground italic mt-10">
          First content draft in your Slack within 30 minutes.
        </p>
      </div>
    </section>
  );
};

export default HowItWorksSection;
