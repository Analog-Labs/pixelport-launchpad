import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductPreview from "./ProductPreview";

const HeroSection = () => (
  <section className="relative min-h-[90vh] flex items-center pt-16 pb-0 overflow-hidden">
    {/* Large ambient amber glow — stronger */}
    <div
      className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none"
      style={{ background: "radial-gradient(circle, hsla(38, 60%, 58%, 0.08) 0%, transparent 60%)" }}
    />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      <div className="grid lg:grid-cols-[55%_45%] gap-8 items-center">
        {/* Left copy */}
        <div className="space-y-5">
          <Badge
            variant="outline"
            className="border-primary/40 text-primary bg-primary/5 px-3 py-1 text-xs font-medium animate-fade-in-up"
          >
            Built on OpenClaw · 46K+ GitHub ⭐
          </Badge>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1] animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            Your AI Chief of Staff
          </h1>
          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            A persistent AI employee that researches competitors, creates platform-native content, manages approvals, and reports performance — all from Slack.
          </p>
          <div
            className="flex flex-wrap gap-3 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Button className="shimmer-btn text-primary-foreground px-6 py-3 text-base font-semibold h-auto">
              Start Free — 14 Day Trial
            </Button>
            <Button variant="outline" className="px-6 py-3 text-base h-auto border-border hover:border-primary/40">
              Book a Demo
            </Button>
          </div>
          <p
            className="text-xs text-muted-foreground animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            No credit card required
          </p>
        </div>

        {/* Right product preview */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <ProductPreview />
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
