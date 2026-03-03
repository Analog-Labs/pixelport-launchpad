import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const CTASection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="relative py-20 sm:py-24 overflow-hidden">
      {/* Strong ambient amber glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[1000px] h-[500px] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, hsla(38, 60%, 58%, 0.10) 0%, transparent 55%)" }}
        />
      </div>

      <div ref={ref} className={`scroll-fade-in ${isVisible ? "visible"  : ""} relative text-center max-w-2xl mx-auto px-4`}>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">Ready to hire your Chief of Staff?</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Start your 14-day free trial. No credit card. No setup fees. Live in 5 minutes.
        </p>
        <Button className="shimmer-btn text-primary-foreground px-10 py-4 text-lg font-semibold h-auto min-w-[200px] hover:scale-[1.03] transition-transform cta-pulse-glow">
          Start Free
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
