import PixelPortLogo from "@/components/PixelPortLogo";

const columns = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Integrations", "FAQ"],
  },
  {
    title: "Company",
    links: ["Blog", "Docs", "About", "Careers"],
  },
  {
    title: "Legal",
    links: ["Terms of Service", "Privacy Policy"],
  },
];

const Footer = () => (
  <footer className="border-t border-border bg-surface/30">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Brand */}
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <PixelPortLogo className="h-7 w-7" />
            <span className="text-base font-bold text-foreground">PixelPort</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Your AI Chief of Staff for marketing.
          </p>
          <p className="text-xs text-muted-foreground">© 2026 Analog</p>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-foreground mb-3">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Social */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Social</p>
          <ul className="space-y-2">
            <li>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                X (Twitter)
              </a>
            </li>
            <li>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
