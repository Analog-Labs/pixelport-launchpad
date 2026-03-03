import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AgentTeamRoom from "./AgentTeamRoom";
import { Clock, Users, ShieldCheck, FileSearch } from "lucide-react";

const proofChips = [
  { icon: Clock, text: "24/7 execution" },
  { icon: Users, text: "Multi-agent collaboration" },
  { icon: ShieldCheck, text: "Approval gates" },
  { icon: FileSearch, text: "Full audit trail" },
];

const HeroSection = () => (
  <section className="relative min-h-screen flex flex-col items-center pt-[120px] pb-16 overflow-hidden">
    {/* Ambient glow */}
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none"
      style={{ background: "radial-gradient(circle, hsla(38, 60%, 58%, 0.08) 0%, transparent 60%)" }}
    />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center">
      {/* Badge */}
      <Badge
        variant="outline"
        className="border-primary/40 text-primary bg-primary/5 px-3 py-1 text-xs font-medium animate-fade-in-up mb-5"
      >
        Built on OpenClaw · 46K+ GitHub ⭐
      </Badge>

      {/* Headline */}
      <h1
        className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1] text-center animate-fade-in-up"
        style={{ animationDelay: "0.1s" }}
      >
        Your AI Chief of Staff
      </h1>

      {/* Subtitle */}
      <p
        className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed text-center mt-5 animate-fade-in-up"
        style={{ animationDelay: "0.2s" }}
      >
        A persistent AI employee that researches competitors, creates platform-native content, manages approvals, and reports performance — all from Slack.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap justify-center gap-3 mt-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
        <Button className="shimmer-btn text-primary-foreground px-6 py-3 text-base font-semibold h-auto">
          Start Free 14 Day Trial
        </Button>
        <Button variant="outline" className="px-6 py-3 text-base h-auto border-border hover:border-primary/40">
          Book a Demo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-3 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
        No credit card required
      </p>

      {/* Agent Team Room */}
      <div className="w-full mt-12 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
        <AgentTeamRoom />
      </div>

      {/* Proof chips */}
      <div className="flex flex-wrap justify-center gap-4 mt-10 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
        {proofChips.map((chip) => (
          <div key={chip.text} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground">
            <chip.icon size={16} className="text-primary" />
            {chip.text}
          </div>
        ))}
      </div>

      {/* Integrations strip */}
      <div className="w-full mt-10 pt-8 border-t border-border animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
        <p className="text-center text-sm text-muted-foreground mb-5">Connects to the tools you already use</p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {/* Slack */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="Slack">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
              <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
              <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
              <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">Slack</span>
          </div>
          {/* LinkedIn */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="LinkedIn">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">LinkedIn</span>
          </div>
          {/* X / Twitter */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="X">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" className="text-muted-foreground group-hover:text-foreground transition-colors duration-300"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">X</span>
          </div>
          {/* OpenAI */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="OpenAI">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor" className="text-muted-foreground group-hover:text-foreground transition-colors duration-300"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">OpenAI</span>
          </div>
          {/* Gemini */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="Gemini">
              <path d="M12 0C12 6.627 17.373 12 24 12c-6.627 0-12 5.373-12 12 0-6.627-5.373-12-12-12 6.627 0 12-5.373 12-12z" fill="#8B5CF6"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">Gemini</span>
          </div>
          {/* Notion */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 100 100" aria-label="Notion">
              <path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fill="currentColor" className="text-muted-foreground group-hover:text-foreground transition-colors duration-300"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M61.35.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l12.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.433-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L74.167 3.143C69.893.227 68.147-.357 61.35.227zM25.33 19.2c-5.2.33-6.387.403-9.35-2.007L8.927 11.48c-.777-.78-.34-1.753 1.163-1.947l52.55-3.887c4.473-.387 6.803 1.17 8.543 2.527l8.157 5.833c.393.193.97 1.363.193 1.363l-54.6 3.443-.003.387zM19.8 88.3V29.133c0-2.53.777-3.697 3.103-3.893L86.1 21.3c2.14-.193 3.107 1.167 3.107 3.693v58.78c0 2.53-.387 4.667-3.883 4.863L25.1 92.2c-3.5.2-5.3-.967-5.3-3.9zM79.14 34.7c.387 1.75 0 3.5-1.75 3.7l-2.53.48v43.407c-2.14 1.167-4.08 1.75-5.83 1.75-2.72 0-3.5-.877-5.44-3.11L45.727 52.76v26.637l5.25 1.17s0 3.497-4.857 3.497l-13.393.777c-.393-.78 0-2.723 1.357-3.11l3.497-.97V42.477l-4.857-.39c-.393-1.75.58-4.277 3.3-4.473l14.363-.967 18.477 28.273V41.373l-4.473-.387c-.393-2.14 1.163-3.693 3.103-3.887z" fill="hsl(var(--card))"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">Notion</span>
          </div>
          {/* HubSpot */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="HubSpot">
              <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066a2.2 2.2 0 0 0-2.2-2.2h-.065a2.2 2.2 0 0 0-2.2 2.2v.066c0 .862.5 1.607 1.227 1.964v2.87a5.91 5.91 0 0 0-2.756 1.338l-7.283-5.67a2.406 2.406 0 0 0 .072-.545 2.428 2.428 0 1 0-2.428 2.428c.396 0 .764-.104 1.094-.273l7.165 5.578a5.93 5.93 0 0 0-.482 2.33c0 .894.2 1.74.554 2.5l-2.14 2.14a1.7 1.7 0 0 0-.496-.078 1.727 1.727 0 1 0 1.727 1.727 1.7 1.7 0 0 0-.078-.497l2.104-2.104a5.94 5.94 0 1 0 4.918-9.988zm-.003 9.28a3.345 3.345 0 1 1 0-6.69 3.345 3.345 0 0 1 0 6.69z" fill="#FF7A59"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">HubSpot</span>
          </div>
          {/* PostHog */}
          <div className="flex flex-col items-center gap-1.5 group cursor-default">
            <svg className="w-7 h-7" viewBox="0 0 24 24" aria-label="PostHog">
              <path d="M12 24l12-12H12V24z" fill="#F9BD2B"/>
              <path d="M0 24l12-12H0V24z" fill="#F9BD2B"/>
              <path d="M12 12l12-12H12V12z" fill="#F9BD2B"/>
              <path d="M0 12l12-12H0V12z" fill="#F9BD2B"/>
            </svg>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">PostHog</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
