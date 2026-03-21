import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/dashboard/Home";
import Connections from "./pages/dashboard/Connections";
import Agents from "./pages/dashboard/Agents";
import Tasks from "./pages/dashboard/Tasks";
import Approvals from "./pages/dashboard/Approvals";
import RunHistory from "./pages/dashboard/RunHistory";
import { DashboardErrorBoundary } from "./components/dashboard/DashboardErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardErrorBoundary>
                    <Dashboard />
                  </DashboardErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Home />} />
              <Route path="agents" element={<Agents />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="runs" element={<RunHistory />} />
              <Route path="connections" element={<Connections />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
