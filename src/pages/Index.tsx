import { Button } from "@/components/ui/button";
import PixelPortLogo from "@/components/PixelPortLogo";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient orbs */}
      <div
        className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-pp-mint opacity-30 pointer-events-none"
        style={{ filter: "blur(80px)" }}
      />
      <div
        className="absolute top-[300px] right-[-150px] w-[500px] h-[500px] rounded-full bg-pp-sky opacity-25 pointer-events-none"
        style={{ filter: "blur(80px)" }}
      />
      <div
        className="absolute bottom-[-100px] left-[10%] w-[400px] h-[400px] rounded-full bg-pp-lavender opacity-20 pointer-events-none"
        style={{ filter: "blur(80px)" }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card-solid border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="flex items-center gap-2.5 text-xl font-bold text-foreground tracking-tight">
              <PixelPortLogo className="h-9 w-9" />
              PixelPort
            </a>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
                Sign in
              </a>
              <Button className="shimmer-btn text-primary-foreground">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative flex flex-col items-center justify-center min-h-screen text-center px-4 pt-16">
        <div className="animate-float mb-8">
          <PixelPortLogo className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>
        <h1 className="section-title max-w-3xl mb-6">
          Welcome to <span className="text-primary">PixelPort</span>
        </h1>
        <p className="section-subtitle mx-auto mb-10">
          Your creative hub is being built. Something amazing is on the way — stay tuned.
        </p>
        <div className="flex gap-4">
          <Button className="shimmer-btn text-primary-foreground px-8 py-3 text-base">
            Get Early Access
          </Button>
          <Button variant="outline" className="px-8 py-3 text-base">
            Learn More
          </Button>
        </div>

        {/* Glass feature cards */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full">
          {[
            { title: "Design", desc: "Craft beautiful interfaces with ease" },
            { title: "Build", desc: "Ship production-ready apps fast" },
            { title: "Scale", desc: "Grow without limits" },
          ].map((item) => (
            <div key={item.title} className="glass-card p-6 text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">© 2026 PixelPort. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
