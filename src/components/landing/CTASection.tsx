import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const CTASection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Ambient amber glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-primary/8 rounded-full blur-[100px]" />
      </div>

      <div ref={ref} className={`scroll-fade-in ${isVisible ? "visible" : ""} relative text-center max-w-2xl mx-auto px-4`}>
        <h2 className="section-title mb-4">Ready to hire your Chief of Staff?</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Start your 14-day free trial. No credit card. No setup fees. Live in 5 minutes.
        </p>
        <Button className="shimmer-btn text-primary-foreground px-8 py-3 text-lg font-semibold h-auto">
          Start Free
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
