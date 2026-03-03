import {
  LayoutDashboard, FileText, Calendar, BarChart3, Brain,
  Search, Link, Settings, LogOut, MessageCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PixelPortLogo from "@/components/PixelPortLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard, end: true },
  { title: "Content Pipeline", url: "/dashboard/content", icon: FileText },
  { title: "Content Calendar", url: "/dashboard/calendar", icon: Calendar },
  { title: "Performance", url: "/dashboard/performance", icon: BarChart3 },
  { title: "Knowledge Vault", url: "/dashboard/vault", icon: Brain },
  { title: "Competitor Intel", url: "/dashboard/competitors", icon: Search },
  { title: "Connections", url: "/dashboard/connections", icon: Link },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }
  return (email?.[0] ?? "U").toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const email = user?.email;
  const initials = getInitials(displayName, email);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[hsl(0_0%_100%/0.06)] bg-[hsl(240_33%_4%)]"
    >
      <SidebarContent className="bg-[hsl(240_33%_4%)]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <PixelPortLogo className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold text-foreground tracking-tight">PixelPort</span>
          )}
        </div>

        {/* Nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-3 h-10 px-3 rounded-md text-muted-foreground transition-colors hover:bg-[hsl(0_0%_100%/0.04)] hover:text-foreground"
                      activeClassName="border-l-2 border-l-primary bg-primary/[0.08] text-foreground [&>svg]:text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-[hsl(240_33%_4%)] border-t border-[hsl(0_0%_100%/0.06)]">
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
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
              className="text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_100%/0.04)] text-sm"
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
