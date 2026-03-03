import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Search, Pencil, BarChart3, MessageSquare, Brain, Zap, Mail, CheckSquare, ClipboardList } from "lucide-react";
import { useEffect, useRef } from "react";

const features = [
  { icon: Search, title: "Competitor Intelligence", desc: "Monitors competitors 24/7. Flags moves, suggests counter-content — before you hear about it." },
  { icon: Pencil, title: "Platform-Native Content", desc: "LinkedIn posts, X threads, images, video — each built for the platform, not copy-pasted." },
  { icon: BarChart3, title: "Performance & KPIs", desc: "Proposes KPIs, tracks weekly, re-evaluates monthly. Self-optimizes based on what's working." },
  { icon: MessageSquare, title: "Lives in Slack", desc: "Works where you work. Approvals, reports, content review — all in threads." },
  { icon: Brain, title: "Learns & Remembers", desc: "Persistent memory that gets smarter every week. Knows your voice, audience, and competitors." },
  { icon: Zap, title: "Proactive, Not Reactive", desc: "Doesn't wait to be asked. Scans trends, drafts content, surfaces opportunities autonomously." },
  { icon: Mail, title: "Email Built In", desc: "Your Chief of Staff has its own inbox. Sends outreach, handles sequences — with your approval." },
  { icon: CheckSquare, title: "Approval Workflows", desc: "Nothing goes live without you. One-click approve, edit, or reject — in Slack or dashboard." },
  { icon: ClipboardList, title: "Daily & Weekly Reports", desc: "Morning digests, weekly deep-dives. Configurable cadence — Slack and dashboard stay in sync." },
];

const FeaturesSection = () => {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !cardsRef.current) return;
    const cards = cardsRef.current.querySelectorAll<HTMLElement>("[data-feature-card]");
    cards.forEach((card, i) => {
      card.style.transitionDelay = `${i * 100}ms`;
      card.classList.add("visible");
    });
  }, [isVisible]);

  return (
    <section id="features" className="section-container-tight">
      <div ref={ref}>
        <div className={`text-center mb-12 scroll-fade-in ${isVisible ? "visible" : ""}`}>
          <h2 className="section-title mb-4">
            Everything a Chief of Staff does — at a fraction of the cost
          </h2>
          <p className="section-subtitle mx-auto">
            One AI employee handles what used to take a team.
          </p>
        </div>

        <div ref={cardsRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              data-feature-card
              className="scroll-fade-in group rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]"
            >
              <f.icon className="text-primary mb-3" size={32} />
              <h3 className="text-base font-semibold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Subtle amber divider line */}
      <div className="mt-16 mx-auto max-w-md h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </section>
  );
};

export default FeaturesSection;
