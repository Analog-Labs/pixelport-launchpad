import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import ChatWidget from "@/components/dashboard/ChatWidget";
import { ChatProvider } from "@/contexts/ChatContext";

const Dashboard = () => (
  <ChatProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 md:hidden">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-4 sm:p-6 relative">
            <Outlet />
          </main>
          <ChatWidget />
        </div>
      </div>
    </SidebarProvider>
  </ChatProvider>
);

export default Dashboard;
