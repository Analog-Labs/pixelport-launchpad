import {
  LayoutDashboard, FileText, CalendarDays, Search, BookOpen,
  Plug, Settings, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const primaryNav = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard, end: true },
  { title: "Content Pipeline", url: "/dashboard/content", icon: FileText },
  { title: "Calendar", url: "/dashboard/calendar", icon: CalendarDays },
  { title: "Competitors", url: "/dashboard/competitors", icon: Search },
  { title: "Knowledge Vault", url: "/dashboard/vault", icon: BookOpen },
  { title: "Connections", url: "/dashboard/connections", icon: Plug },
];

const secondaryNav = [
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }
  return (email?.[0] ?? "U").toUpperCase();
}

function getAgentStatus(): { name: string; status: string } {
  const name = localStorage.getItem("pixelport_agent_name") || "Chief of Staff";
  const status = localStorage.getItem("pixelport_tenant_status") || "provisioning";
  return { name, status };
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const email = user?.email;
  const initials = getInitials(displayName, email);
  const agent = getAgentStatus();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItemClass = "flex items-center gap-3 h-9 px-3 rounded-md text-sm text-zinc-400 transition-colors duration-150 hover:bg-zinc-800/50 hover:text-zinc-100";
  const activeClass = "bg-zinc-800 text-white font-medium";

  const renderNavItems = (items: typeof primaryNav) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.end}
            className={navItemClass}
            activeClassName={activeClass}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarContent className="bg-sidebar">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <PixelPortLogo className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold text-foreground tracking-tight">PixelPort</span>
          )}
        </div>

        {/* Primary nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(primaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-2 mx-3" />

        {/* Secondary nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(secondaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-border">
        {/* Agent status */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              agent.status === "active" ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {!collapsed && (
            <span className="text-xs text-zinc-500 truncate">{agent.name}</span>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground truncate">
                {displayName || email || "User"}
              </span>
              {displayName && email && (
                <span className="text-xs text-muted-foreground truncate">{email}</span>
              )}
            </div>
          )}
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground hover:bg-zinc-800/50 text-sm"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
