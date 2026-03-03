import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Lock, KeyRound, Brain, ClipboardList } from "lucide-react";

const items = [
  { icon: Lock, title: "Isolated Infrastructure", desc: "Every customer gets a dedicated virtual machine. Your data never touches other environments." },
  { icon: KeyRound, title: "Encrypted Credentials", desc: "OAuth tokens and API keys encrypted at rest. Role-based access control." },
  { icon: Brain, title: "Private Memory", desc: "Your agent's memory is scoped to your tenant. No cross-customer data leakage." },
  { icon: ClipboardList, title: "Full Audit Trail", desc: "Every action logged — who, what, when, why. Complete transparency." },
];

const SecuritySection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="section-container-tight">
      <div ref={ref} className={`scroll-fade-in ${isVisible ? "visible" : ""}`}>
        <div className="text-center mb-12">
          <h2 className="section-title">Enterprise-grade from day one</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-6 text-center min-w-0">
              <item.icon className="text-primary mx-auto mb-4" size={40} />
              <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
