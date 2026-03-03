import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "What is PixelPort?", a: "PixelPort is an AI employee — a persistent Chief of Staff that handles your marketing. It researches competitors, creates content, manages approvals, and reports performance. It works from Slack and a purpose-built dashboard." },
  { q: "How is this different from ChatGPT or Jasper?", a: "Those are tools you prompt. PixelPort is an employee that works proactively — scanning trends, drafting content, monitoring competitors, and reporting results without being asked." },
  { q: "What happens during the 14-day trial?", a: "Full access to all features with a capped LLM budget. Your Chief of Staff onboards, scans your brand, and starts producing content within 30 minutes. No credit card required." },
  { q: "Can I customize my agent?", a: "Yes. Name it, upload an avatar, set the tone (casual, professional, or custom). It learns your brand voice automatically and gets smarter every week." },
  { q: "What content can it create?", a: "LinkedIn posts, X threads, blog drafts, email sequences, images, and video — all platform-native. Your Chief of Staff decides what each post needs." },
  { q: "Is my data secure?", a: "Every customer gets an isolated virtual machine. Your data never touches other environments. All credentials are encrypted at rest." },
  { q: "Do I need technical skills?", a: "No. Connect your tools with one-click OAuth, describe your goals, and your Chief of Staff handles the rest. No code, no DevOps." },
  { q: "Can I use my own LLM keys?", a: "Yes. PixelPort provides default keys so you can start instantly, but you can add your own OpenAI, Anthropic, Google, or other provider keys anytime." },
];

const FAQSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="faq" className="section-container">
      <div ref={ref} className={`scroll-fade-in ${isVisible ? "visible" : ""}`}>
        <div className="text-center mb-16">
          <h2 className="section-title">Frequently asked questions</h2>
        </div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline [&>svg]:text-primary">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
