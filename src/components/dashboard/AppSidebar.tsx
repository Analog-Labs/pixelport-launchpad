import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  ListTodo,
  Bot,
  Clock,
  DollarSign,
  Plug,
  LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';
import PixelPortLogo from '@/components/PixelPortLogo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/** DD-1: nav order — action items first, monitoring second, settings last */
const primaryNav = [
  { title: 'Home', url: '/dashboard', icon: LayoutDashboard, end: true, badge: null },
  { title: 'Inbox', url: '/dashboard/inbox', icon: Inbox, badge: 'inbox' as const },
  { title: 'Approvals', url: '/dashboard/approvals', icon: CheckSquare, badge: 'approvals' as const },
  { title: 'Tasks', url: '/dashboard/tasks', icon: ListTodo, badge: null },
  { title: 'Agents', url: '/dashboard/agents', icon: Bot, badge: null },
  { title: 'Runs', url: '/dashboard/runs', icon: Clock, badge: null },
  { title: 'Costs', url: '/dashboard/costs', icon: DollarSign, badge: null },
  { title: 'Connections', url: '/dashboard/connections', icon: Plug, badge: null },
];

function getInitials(name?: string | null, email?: string | null): string {
  if (name) return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return (email?.[0] ?? 'U').toUpperCase();
}

function getAgentStatus(): { name: string; status: string } {
  const name = localStorage.getItem('pixelport_agent_name') || 'Chief of Staff';
  const status = localStorage.getItem('pixelport_tenant_status') || 'provisioning';
  return { name, status };
}

/**
 * Animated badge count. DD-9: brief scale pulse on count change.
 */
function BadgePill({ count }: { count: number }) {
  const [animating, setAnimating] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      setAnimating(true);
      prevCount.current = count;
      const t = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(t);
    }
  }, [count]);

  return (
    <span
      className={cn(
        'ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full',
        'bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-black',
        'transition-transform duration-300',
        animating && 'scale-125',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const badgesQuery = useSidebarBadges();

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const email = user?.email;
  const initials = getInitials(displayName, email);
  const storedAgent = getAgentStatus();
  const agentName =
    (typeof tenant?.onboarding_data?.agent_name === 'string' && tenant.onboarding_data.agent_name) ||
    storedAgent.name;
  const agentStatus = tenant?.status || storedAgent.status;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getBadgeCount = (key: 'approvals' | 'inbox' | null): number | null => {
    if (!key || !badgesQuery.data) return null;
    const count = badgesQuery.data[key];
    return count && count > 0 ? count : null;
  };

  const navItemClass =
    'relative flex items-center gap-3 h-9 px-3 rounded-md text-sm text-zinc-400 transition-colors duration-150 hover:bg-zinc-800/50 hover:text-zinc-100';
  const activeClass = 'bg-zinc-800 text-white font-medium';

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
            <SidebarMenu>
              {primaryNav.map((item) => {
                const badgeCount = getBadgeCount(item.badge);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className={navItemClass}
                        activeClassName={activeClass}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {badgeCount != null && <BadgePill count={badgeCount} />}
                          </>
                        )}
                        {/* Collapsed: show dot indicator if badge count > 0 */}
                        {collapsed && badgeCount != null && (
                          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-border">
        {/* Agent status */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              agentStatus === 'active' ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {!collapsed && (
            <span className="text-xs text-zinc-500 truncate">{agentName}</span>
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
                {displayName || email || 'User'}
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
