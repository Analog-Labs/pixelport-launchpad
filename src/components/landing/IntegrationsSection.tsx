import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useEffect, useRef } from "react";
import {
  MessageSquare, Mail, Linkedin, Twitter, Brain, Sparkles, Bot, Zap,
  BarChart, Database, Cloud, FileText, Image, Video, Film, User,
} from "lucide-react";

const integrations = [
  { name: "Slack", icon: MessageSquare },
  { name: "Gmail", icon: Mail },
  { name: "LinkedIn", icon: Linkedin },
  { name: "X (Twitter)", icon: Twitter },
  { name: "OpenAI", icon: Brain },
  { name: "Gemini", icon: Sparkles },
  { name: "Anthropic", icon: Bot },
  { name: "xAI", icon: Zap },
  { name: "PostHog", icon: BarChart },
  { name: "HubSpot", icon: Database },
  { name: "Salesforce", icon: Cloud },
  { name: "Notion", icon: FileText },
  { name: "FLUX", icon: Image },
  { name: "Runway", icon: Video },
  { name: "Sora", icon: Film },
  { name: "HeyGen", icon: User },
];

const IntegrationsSection = () => {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !gridRef.current) return;
    const tiles = gridRef.current.querySelectorAll<HTMLElement>("[data-int-tile]");
    tiles.forEach((tile, i) => {
      tile.style.transitionDelay = `${i * 50}ms`;
      tile.classList.add("visible");
    });
  }, [isVisible]);

  return (
    <section id="integrations" className="section-container-tight">
      <div ref={ref}>
        <div className={`text-center mb-12 scroll-fade-in ${isVisible ? "visible" : ""}`}>
          <h2 className="section-title">Connects to the tools you already use</h2>
        </div>

        <div ref={gridRef} className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
          {integrations.map((item) => (
            <div
              key={item.name}
              data-int-tile
              className="scroll-fade-in group flex flex-col items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(212,168,83,0.1)] cursor-default"
            >
              <item.icon
                size={28}
                className="text-muted-foreground group-hover:text-primary transition-colors duration-300 mb-1.5"
              />
              <span className="text-[10px] sm:text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-center leading-tight px-1">
                {item.name}
              </span>
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
