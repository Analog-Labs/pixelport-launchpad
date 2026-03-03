import { useState, useEffect } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepCompanyInfo from "@/components/onboarding/StepCompanyInfo";
import StepAgentSetup from "@/components/onboarding/StepAgentSetup";
import StepConnectTools from "@/components/onboarding/StepConnectTools";

interface OnboardingData {
  company_name: string;
  company_url: string;
  goals: string[];
  other_goal: string;
  agent_name: string;
  agent_tone: string;
  agent_avatar: string;
}

const LOADING_MESSAGES = [
  "Setting up your workspace...",
  "Configuring your Chief of Staff...",
  "Scanning your website...",
  "Almost ready...",
];

const Onboarding = () => {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [launching, setLaunching] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const [data, setData] = useState<OnboardingData>({
    company_name: "",
    company_url: "",
    goals: [],
    other_goal: "",
    agent_name: "Luna",
    agent_tone: "professional",
    agent_avatar: "amber-l",
  });

  // Step transition animation
  const changeStep = (next: number) => {
    setFadeIn(false);
    setTimeout(() => {
      setStep(next);
      setFadeIn(true);
    }, 200);
  };

  // Loading message cycling
  useEffect(() => {
    if (!launching) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [launching]);

  const handleLaunch = async () => {
    const payload = {
      company_name: data.company_name.trim(),
      company_url: data.company_url.trim() || null,
      goals: data.goals.map((g) => (g === "Other" && data.other_goal ? data.other_goal : g)),
      agent_name: data.agent_name.trim() || "Luna",
      agent_tone: data.agent_tone,
      agent_avatar_url: data.agent_avatar,
    };

    localStorage.setItem("pixelport_onboarded", "true");
    localStorage.setItem("pixelport_agent_name", payload.agent_name);
    localStorage.setItem("pixelport_agent_avatar", payload.agent_avatar_url);
    localStorage.setItem("pixelport_company_name", payload.company_name || "");
    localStorage.setItem("pixelport_company_url", payload.company_url || "");
    localStorage.setItem("pixelport_agent_tone", payload.agent_tone);

    setLaunching(true);

    const apiCall = (async () => {
      try {
        const token = session?.access_token;
        if (token) {
          const res = await fetch("/api/tenants", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const result = await res.json();
          if (result.tenant?.id) {
            localStorage.setItem("pixelport_tenant_id", result.tenant.id);
            localStorage.setItem("pixelport_tenant_status", result.tenant.status);
          }
          if (!res.ok) {
            console.error("Tenant creation failed:", result);
          }
        }
      } catch (err) {
        console.error("Tenant creation error:", err);
      }
    })();

    await Promise.all([
      apiCall,
      new Promise(resolve => setTimeout(resolve, 4000)),
    ]);

    navigate("/dashboard", { replace: true });
  };

  const patch = (p: Partial<OnboardingData>) => setData((d) => ({ ...d, ...p }));

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (localStorage.getItem("pixelport_onboarded")) return <Navigate to="/dashboard" replace />;

  // Launching state
  if (launching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center">
          <PixelPortLogo className="h-12 w-12 animate-pulse" />
          <p className="text-lg font-medium text-foreground transition-opacity duration-500">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </p>
          <div className="flex gap-2">
            {LOADING_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                  i <= loadingMsgIdx ? "bg-primary" : "bg-[hsl(240_10%_20%)]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, hsla(38,60%,58%,0.08) 0%, transparent 70%)" }}
      />

      {/* Logo */}
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2.5 z-10">
        <PixelPortLogo className="h-8 w-8" />
        <span className="text-xl font-bold text-foreground tracking-tight">PixelPort</span>
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-[640px] rounded-2xl border bg-card p-6 sm:p-10 relative z-10"
        style={{ borderColor: "rgba(212,168,83,0.15)" }}
      >
        <StepIndicator currentStep={step} />

        <div
          className="transition-all duration-200"
          style={{ opacity: fadeIn ? 1 : 0, transform: fadeIn ? "translateY(0)" : "translateY(8px)" }}
        >
          {step === 1 && (
            <StepCompanyInfo
              data={data}
              onChange={patch}
              onNext={() => changeStep(2)}
            />
          )}
          {step === 2 && (
            <StepAgentSetup
              data={data}
              onChange={patch}
              onNext={() => changeStep(3)}
              onBack={() => changeStep(1)}
            />
          )}
          {step === 3 && (
            <StepConnectTools
              agentName={data.agent_name}
              onBack={() => changeStep(2)}
              onLaunch={handleLaunch}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
