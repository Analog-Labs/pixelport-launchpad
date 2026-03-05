# Phase 1 Frontend Integration Proposals

> **For:** Founder (apply in Lovable)
> **From:** CTO
> **Date:** 2026-03-04
> **Status:** All backend endpoints deployed and tested. These proposals wire the existing frontend to real APIs.

---

## Priority 1: Scan Wiring (I1b)

**What this does:** When a customer enters their company URL during onboarding, we scan their website in the background. The scan extracts company info (industry, products, target audience, tone) using AI. This data gets injected into the agent's knowledge base so it knows about the customer's business from day one.

**Why it matters:** Without this, the agent launches with zero knowledge about the customer. The scan is what makes the first interaction feel smart.

**File to change:** `src/pages/Onboarding.tsx`

### Current behavior
- User enters company URL in Step 1
- URL is saved to localStorage
- When user clicks "Launch" in Step 3, `POST /api/tenants` is called with the URL but **no scan results**
- The provisioning pipeline receives an empty `scan_results` field

### Desired behavior
1. User enters company URL in Step 1 and clicks "Next"
2. Frontend immediately calls `POST /api/tenants/scan` in the background (non-blocking)
3. User continues through Steps 2 and 3 normally (doesn't wait for scan)
4. When user clicks "Launch" in Step 3, include the scan results (if available) in the `POST /api/tenants` payload

### Changes needed in `Onboarding.tsx`

**Add state for scan results (around line 33, after the `fadeIn` state):**

```tsx
const [scanResults, setScanResults] = useState<Record<string, any> | null>(null);
const [scanError, setScanError] = useState(false);
```

**Add a function to trigger the scan (before `handleLaunch`):**

```tsx
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
```

**Call the scan when leaving Step 1 (modify the `changeStep` call for Step 1 → 2):**

In the step transition from 1 to 2, after `changeStep(2)`, also fire the scan:

```tsx
// In StepCompanyInfo's onNext handler:
onNext={() => {
  changeStep(2);
  triggerScan(data.company_url);
}}
```

**Include scan results in the tenant creation payload (modify `handleLaunch`, around line 64):**

Add `scan_results` to the payload object:

```tsx
const payload = {
  company_name: data.company_name.trim(),
  company_url: data.company_url.trim() || null,
  goals: data.goals.map((g) => (g === "Other" && data.other_goal ? data.other_goal : g)),
  agent_name: data.agent_name.trim() || "Luna",
  agent_tone: data.agent_tone,
  agent_avatar_url: data.agent_avatar,
  scan_results: scanResults,  // <-- ADD THIS LINE
};
```

### API contract

**POST /api/tenants/scan**
- Request: `{ "company_url": "https://example.com" }`
- Response: `{ "scan_results": { "company_name": "...", "industry": "...", "products_services": [...], "target_audience": "...", "brand_tone": "...", "key_differentiators": [...], "tagline": "..." } }`
- Auth: Bearer token (same as other API calls)
- Timing: Takes 3-8 seconds. Runs in background, doesn't block onboarding.
- Error handling: If scan fails, we just proceed without it. The agent still works, just without pre-loaded knowledge.

### No UI changes needed
The existing loading messages already include "Scanning your website..." which is perfect. The scan runs silently in the background during Steps 2-3.

---

## Priority 2: Connections Page + Slack OAuth (I4)

**What this does:** Replaces the empty "Connections" page with a real integration management view. Shows a "Connect Slack" button that starts the OAuth flow, and displays connection status after Slack is connected.

**Why it matters:** This is how customers connect their Slack workspace so the agent can actually talk to them. Without this page, there's no way to initiate Slack OAuth.

**File to change:** `src/pages/dashboard/Connections.tsx`

### Current behavior
- Shows an `EmptyState` component with generic text
- No API calls, no functionality

### Desired behavior
1. On page load, call `GET /api/connections` to check what's connected
2. Show Slack integration card with status:
   - **Not connected:** "Connect Slack" button
   - **Connected:** Green status, team name, connected date
3. Show Email integration card (read-only, auto-provisioned)
4. Handle `?slack=connected` query param (from OAuth callback redirect) with a success toast
5. Handle `?error=...` query param with an error toast

### Full replacement for `Connections.tsx`

```tsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SlackInfo {
  connected: boolean;
  team_name?: string;
  connected_at?: string;
}

interface EmailInfo {
  connected: boolean;
  inbox: string | null;
}

const Connections = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [slack, setSlack] = useState<SlackInfo>({ connected: false });
  const [email, setEmail] = useState<EmailInfo>({ connected: false, inbox: null });
  const [connecting, setConnecting] = useState(false);

  // Fetch integration status
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/connections", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSlack(data.integrations?.slack || { connected: false });
          setEmail(data.integrations?.email || { connected: false, inbox: null });
        }
      } catch (err) {
        console.error("Failed to fetch connections:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConnections();
  }, [session]);

  // Handle OAuth callback query params
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    const errorParam = searchParams.get("error");

    if (slackParam === "connected") {
      toast({
        title: "Slack connected!",
        description: "Your agent is being activated in your Slack workspace.",
      });
      setSlack((prev) => ({ ...prev, connected: true }));
      setSearchParams({}, { replace: true });
    } else if (errorParam) {
      toast({
        title: "Connection failed",
        description: `Slack returned an error: ${errorParam}`,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const handleConnectSlack = () => {
    setConnecting(true);
    // Redirect to Slack OAuth — this is a full-page redirect, not a fetch
    window.location.href = "/api/connections/slack/install";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connections</h1>
        <p className="text-muted-foreground mt-1">
          Manage your integrations. Connect tools to let your agent work across platforms.
        </p>
      </div>

      {/* Slack */}
      <Card className="bg-card border-primary/15">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-[#4A154B] flex items-center justify-center shrink-0">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Slack</h3>
            {slack.connected ? (
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-400">
                  Connected{slack.team_name ? ` to ${slack.team_name}` : ""}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Connect Slack to chat with your agent directly in your workspace.
              </p>
            )}
          </div>
          {!slack.connected && (
            <Button onClick={handleConnectSlack} disabled={connecting}>
              {connecting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Connecting...</>
              ) : (
                "Connect Slack"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Email */}
      <Card className="bg-card border-primary/15">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Email</h3>
            {email.connected && email.inbox ? (
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-400">{email.inbox}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Email inbox is provisioned automatically during setup.
              </p>
            )}
          </div>
          {email.connected && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Auto-provisioned</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Connections;
```

### API contract

**GET /api/connections**
- Response: `{ "integrations": { "slack": { "connected": true, "team_name": "My Workspace", "connected_at": "2026-03-04T..." }, "email": { "connected": true, "inbox": "myco@agentmail.to" } } }`
- Auth: Bearer token

**GET /api/connections/slack/install**
- This is NOT a fetch call. It's a full-page redirect (`window.location.href`).
- It redirects to Slack's OAuth page.
- After the user approves, Slack redirects back to `/api/connections/slack/callback`.
- The callback redirects to `/dashboard/connections?slack=connected` on success or `?error=...` on failure.

### Dependencies
- `useToast` hook (should already exist in your UI library — it's from shadcn/ui)
- `useSearchParams` from react-router-dom (already in use elsewhere)

---

## Priority 3: Dashboard Home Status Polling (I3)

**What this does:** Replaces the hardcoded 10-second delay for "agent active" status with real API polling. The dashboard will show the actual provisioning state and update live as the agent gets set up.

**Why it matters:** Right now the dashboard pretends the agent is active after 10 seconds regardless of reality. Real provisioning takes ~7 minutes. We need to show actual progress.

**File to change:** `src/pages/dashboard/Home.tsx`

### Current behavior (line 56-60)
```tsx
useEffect(() => {
  if (!isOnboarded) return;
  const timer = setTimeout(() => setAgentActive(true), 10000);
  return () => clearTimeout(timer);
}, [isOnboarded]);
```
Hardcoded 10-second timeout, no API call.

### Desired behavior
1. On mount (if onboarded), call `GET /api/tenants/status`
2. If status is `provisioning`, poll every 10 seconds
3. When status changes to `active`, stop polling and show green "Active" status
4. If status is `failed`, show red error state
5. Also display provisioning sub-steps (has_droplet, has_gateway, etc.) as progress indicators

### Changes to `Home.tsx`

**Add status state (replace the simple `agentActive` boolean around line 54):**

```tsx
const [tenantStatus, setTenantStatus] = useState<string>(
  localStorage.getItem("pixelport_tenant_status") || "provisioning"
);
const agentActive = tenantStatus === "active";
```

**Replace the hardcoded useEffect (lines 56-60) with real polling:**

```tsx
useEffect(() => {
  if (!isOnboarded) return;

  let cancelled = false;

  const checkStatus = async () => {
    try {
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/tenants/status", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok && !cancelled) {
        const data = await res.json();
        setTenantStatus(data.status);
        localStorage.setItem("pixelport_tenant_status", data.status);
      }
    } catch {
      // Silently retry on next interval
    }
  };

  checkStatus();

  // Poll every 10 seconds while not active
  const interval = setInterval(() => {
    if (tenantStatus !== "active" && tenantStatus !== "failed") {
      checkStatus();
    }
  }, 10000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [isOnboarded, session, tenantStatus]);
```

**Note:** You'll need to add `session` to the component. Add this line near the existing `useAuth()` call:

```tsx
const { user, session } = useAuth();  // was: const { user } = useAuth();
```

**Update the stat cards (around line 75) to handle the failed state:**

```tsx
{
  label: "Agent Status",
  value: tenantStatus === "active"
    ? "Active"
    : tenantStatus === "failed"
    ? "Setup Failed"
    : "Provisioning...",
  valueClass: tenantStatus === "active"
    ? "text-green-400"
    : tenantStatus === "failed"
    ? "text-red-400"
    : "text-primary",
  pulse: tenantStatus === "provisioning",
},
```

### API contract

**GET /api/tenants/status**
- Response: `{ "status": "provisioning" | "active" | "failed", "has_droplet": true, "has_gateway": false, "has_litellm": true, "has_agentmail": true, "plan": "trial", "trial_ends_at": "..." }`
- Auth: Bearer token
- The `has_*` fields can optionally be used to show a progress checklist, but the main status field is what matters most.

---

## Priority 4: Chat SSE Streaming (I2) — Lower Priority

**What this does:** Replaces the simulated chat replies (hardcoded responses after timeouts) with real Server-Sent Events streaming from the agent.

**Why it matters:** This makes the dashboard chat actually talk to the AI agent. However, this is lower priority because **Slack is the primary channel for Phase 1**. The dashboard chat will gracefully say "agent is being provisioned" if the gateway isn't ready yet.

**Files to change:**
- `src/contexts/ChatContext.tsx`
- `src/components/dashboard/ChatWidget.tsx`
- `src/pages/dashboard/Chat.tsx`

### Current behavior
Both `ChatWidget.tsx` (line 68-78) and `Chat.tsx` (line 55-64) have identical hardcoded replies:
```tsx
setTimeout(() => setIsTyping(true), 1500);
setTimeout(() => {
  setIsTyping(false);
  addMessage("assistant", "I'm still being provisioned...");
}, 2500);
```

### Desired behavior
1. User sends message
2. Frontend calls `POST /api/chat` with SSE streaming
3. Tokens stream in real-time (typing effect)
4. If the agent gateway isn't ready (4xx/5xx), show a friendly fallback message
5. On first load, optionally fetch `GET /api/chat/history` for previous messages

### Changes to `ChatContext.tsx`

**Add a `sendMessage` function that handles SSE, and a `sessionId` state:**

```tsx
const [sessionId, setSessionId] = useState<string | null>(null);

const sendMessage = useCallback(async (
  text: string,
  token: string | null
): Promise<void> => {
  // Add user message immediately
  const userMsgId = crypto.randomUUID();
  setMessages((prev) => [
    ...prev,
    { id: userMsgId, role: "user", content: text, timestamp: new Date() },
  ]);

  if (!token) {
    // Not authenticated — add fallback
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I can't connect right now. Please make sure you're logged in.",
        timestamp: new Date(),
      },
    ]);
    return;
  }

  // Create a placeholder assistant message for streaming
  const assistantMsgId = crypto.randomUUID();
  setMessages((prev) => [
    ...prev,
    { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date() },
  ]);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: text,
        session_id: sessionId,
      }),
    });

    if (!res.ok) {
      // Gateway not ready or other error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: "I'm still being set up — I'll be fully online soon! Try again in a few minutes, or reach me in Slack." }
            : m
        )
      );
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const event = JSON.parse(jsonStr);

          if (event.type === "session") {
            setSessionId(event.session_id);
          } else if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + event.content }
                  : m
              )
            );
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: event.error || "Something went wrong." }
                  : m
              )
            );
          }
          // "done" type — streaming complete, no action needed
        } catch {
          // Skip unparseable SSE lines
        }
      }
    }
  } catch {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? { ...m, content: "Connection error — please try again." }
          : m
      )
    );
  }
}, [sessionId]);
```

**Update the context type and provider value to include `sendMessage` and `sessionId`:**

```tsx
interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (role: "user" | "assistant", content: string) => void;
  sendMessage: (text: string, token: string | null) => Promise<void>;
  isWidgetOpen: boolean;
  setWidgetOpen: (open: boolean) => void;
  sessionId: string | null;
}
```

### Changes to `ChatWidget.tsx` and `Chat.tsx`

**Replace the `handleSend` function in both files:**

```tsx
const { messages, sendMessage, isWidgetOpen, setWidgetOpen } = useChat();
const { session } = useAuth();

const handleSend = () => {
  const text = input.trim();
  if (!text) return;
  setInput("");
  sendMessage(text, session?.access_token || null);
};
```

Remove:
- The `addMessage` import/usage (replaced by `sendMessage`)
- The `isTyping` state and all `setTimeout` blocks
- The `TypingIndicator` is still useful — you can show it while the last assistant message has empty content

**Optional: Show typing indicator while streaming:**

```tsx
const lastMsg = messages[messages.length - 1];
const isStreaming = lastMsg?.role === "assistant" && lastMsg.content === "";
```

Use `isStreaming` instead of `isTyping` to show the typing dots.

### API contract

**POST /api/chat**
- Request: `{ "message": "Hello", "session_id": "optional-uuid" }`
- Response: SSE stream with events:
  - `data: {"type":"session","session_id":"uuid"}` — sent first
  - `data: {"type":"token","content":"Hello"}` — streamed tokens
  - `data: {"type":"done","message_id":"uuid","session_id":"uuid"}` — end
  - `data: {"type":"error","error":"message"}` — if something fails
- Auth: Bearer token
- Requires tenant status = `active` and a working gateway. Returns 503 if agent isn't ready.

**GET /api/chat/history**
- Request: `?session_id=uuid&limit=20`
- Response: `{ "session": {...}, "messages": [...], "total": 5 }`
- Auth: Bearer token
- Use this to load previous messages on page load (optional for Phase 1).

---

## Implementation Order

| # | Task | Priority | Complexity |
|---|------|----------|------------|
| 1 | Scan wiring in Onboarding.tsx | **Must have** | Small (add ~20 lines) |
| 2 | Connections page (Slack OAuth + status) | **Must have** | Medium (replace entire component) |
| 3 | Dashboard home status polling | **Should have** | Small (replace 1 useEffect) |
| 4 | Chat SSE streaming | **Nice to have** | Medium-Large (3 files, SSE parsing) |

**Recommended approach:** Do #1 and #2 first. These are required for the end-to-end test (sign up → scan → provision → connect Slack → DM bot). #3 is a quality improvement. #4 can wait — Slack is the primary channel.

---

## Testing After Wiring

Once #1 and #2 are applied, we can run the full end-to-end test:

1. Sign up as a new user
2. Enter company URL → verify scan runs (check network tab for POST /api/tenants/scan)
3. Pick agent name/tone → click Launch
4. Verify POST /api/tenants includes `scan_results` in payload
5. Dashboard shows "Provisioning..." status
6. Navigate to Connections → click "Connect Slack"
7. Complete Slack OAuth → redirected back with `?slack=connected`
8. Connections page shows green "Connected" status
9. DM the bot in Slack → verify it responds

CTO will coordinate the smoke test once wiring is applied.
