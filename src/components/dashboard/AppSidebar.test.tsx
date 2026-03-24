/**
 * Unit test: Sidebar badge rendering.
 * Verifies that badge counts from useSidebarBadges appear in the sidebar.
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

const { useAuthMock, useSidebarBadgesMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useSidebarBadgesMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('@/hooks/useSidebarBadges', () => ({
  useSidebarBadges: useSidebarBadgesMock,
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}));
vi.mock('@/components/NavLink', () => ({
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}));

function renderSidebar() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </QueryClientProvider>,
  );
}

describe('AppSidebar badge rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { email: 'test@example.com', user_metadata: {} },
      tenant: { status: 'active', onboarding_data: { agent_name: 'Chief' } },
      signOut: vi.fn(),
    });
  });

  it('shows badge count when approvals > 0', () => {
    useSidebarBadgesMock.mockReturnValue({ data: { approvals: 5 } });
    renderSidebar();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows inbox badge count when inbox > 0', () => {
    useSidebarBadgesMock.mockReturnValue({ data: { approvals: 0, inbox: 3 } });
    renderSidebar();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does NOT show badge when approvals = 0', () => {
    useSidebarBadgesMock.mockReturnValue({ data: { approvals: 0 } });
    renderSidebar();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('does NOT show badge when badges data is undefined', () => {
    useSidebarBadgesMock.mockReturnValue({ data: undefined });
    renderSidebar();
    // Nav items should still render
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
  });

  it('shows 99+ for counts over 99', () => {
    useSidebarBadgesMock.mockReturnValue({ data: { approvals: 150 } });
    renderSidebar();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders all primary nav items in correct order (DD-1)', () => {
    useSidebarBadgesMock.mockReturnValue({ data: { approvals: 0 } });
    renderSidebar();

    const navItems = screen.getAllByRole('link');
    const navTexts = navItems.map((el) => el.textContent?.trim()).filter(Boolean);

    // Home should come before Approvals, Approvals before Tasks, etc.
    const homeIdx = navTexts.findIndex((t) => t === 'Home');
    const approvalsIdx = navTexts.findIndex((t) => t?.includes('Approvals'));
    const tasksIdx = navTexts.findIndex((t) => t === 'Tasks');

    expect(homeIdx).toBeGreaterThanOrEqual(0);
    expect(approvalsIdx).toBeGreaterThan(homeIdx);
    expect(tasksIdx).toBeGreaterThan(approvalsIdx);
  });
});
