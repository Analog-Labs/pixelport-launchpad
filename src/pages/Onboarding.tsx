import { useState, useEffect } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import StepIndicator from "@/components/onboarding/StepIndicator";
import StepCompanyInfo from "@/components/onboarding/StepCompanyInfo";
import StepAgentSetup from "@/components/onboarding/StepAgentSetup";
import StepConnectTools from "@/components/onboarding/StepConnectTools";
import { getPostAuthRedirectPath } from "@/lib/dashboard-redirect";

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
  const {
    user,
    session,
    tenant,
    loading: authLoading,
    tenantLoading,
    refreshTenant,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [launching, setLaunching] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [scanResults, setScanResults] = useState<Record<string, any> | null>(null);
  const [scanError, setScanError] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const [data, setData] = useState<OnboardingData>({
    company_name: "",
    company_url: "",
    goals: [],
    other_goal: "",
    agent_name: "Luna",
    agent_tone: "professional",
    agent_avatar: "amber-l",
  });
  const redirectPath = getPostAuthRedirectPath(location.state);

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

  const triggerScan = async (url: string) => {
    if (!url.trim()) return;
    try {
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/tenants/scan", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_url: url.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        setScanResults(result.scan_results || null);
      } else {
        setScanError(true);
      }
    } catch {
      setScanError(true);
    }
  };

  const handleLaunch = async () => {
    setLaunchError("");

    const payload = {
      company_name: data.company_name.trim(),
      company_url: data.company_url.trim() || null,
      goals: data.goals.map((g) => (g === "Other" && data.other_goal ? data.other_goal : g)),
      agent_name: data.agent_name.trim() || "Luna",
      agent_tone: data.agent_tone,
      agent_avatar_url: data.agent_avatar,
      scan_results: scanResults,
    };

    setLaunching(true);

    try {
      const token = session?.access_token;
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create your workspace.");
      }

      await Promise.all([
        refreshTenant(),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);

      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error("Tenant creation error:", err);
      setLaunching(false);
      setLaunchError(err instanceof Error ? err.message : "Failed to create your workspace.");
    }
  };

  const patch = (p: Partial<OnboardingData>) => setData((d) => ({ ...d, ...p }));

  if (authLoading || tenantLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (tenant) return <Navigate to={redirectPath} replace />;

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
              onNext={() => {
                changeStep(2);
                triggerScan(data.company_url);
              }}
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
              error={launchError}
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
