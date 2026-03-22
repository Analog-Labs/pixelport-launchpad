import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardErrorBoundary } from "@/components/dashboard/DashboardErrorBoundary";

const Dashboard = () => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b border-border px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 sm:p-6 relative">
          <DashboardErrorBoundary>
            <Outlet />
          </DashboardErrorBoundary>
        </main>
      </div>
    </div>
  </SidebarProvider>
);

export default Dashboard;
