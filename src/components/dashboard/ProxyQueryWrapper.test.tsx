import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProxyQueryWrapper } from './ProxyQueryWrapper';
import type { UseQueryResult } from '@tanstack/react-query';

type FakeQuery = Pick<
  UseQueryResult<{ items: string[] }, Error>,
  'isLoading' | 'isError' | 'data' | 'error' | 'refetch'
>;

function makeQuery(overrides: Partial<FakeQuery>): FakeQuery {
  return {
    isLoading: false,
    isError: false,
    data: undefined,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProxyQueryWrapper', () => {
  it('renders skeleton when loading', () => {
    const query = makeQuery({ isLoading: true });
    render(
      <ProxyQueryWrapper
        query={query as UseQueryResult<{ items: string[] }, Error>}
        skeleton={<div data-testid="skel">Loading...</div>}
      >
        {() => <div>Content</div>}
      </ProxyQueryWrapper>,
    );
    expect(screen.getByTestId('skel')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders error state with retry button when query fails', () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const query = makeQuery({
      isError: true,
      error: new Error('Proxy failed'),
      refetch: refetchMock,
    });

    render(
      <ProxyQueryWrapper
        query={query as UseQueryResult<{ items: string[] }, Error>}
        skeleton={<div>Skeleton</div>}
        errorLabel="agents"
      >
        {() => <div>Content</div>}
      </ProxyQueryWrapper>,
    );

    expect(screen.getByText(/Failed to load agents/i)).toBeInTheDocument();
    expect(screen.getByText('Proxy failed')).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    const query = makeQuery({
      isError: true,
      error: new Error('Network error'),
      refetch: refetchMock,
    });

    render(
      <ProxyQueryWrapper
        query={query as UseQueryResult<{ items: string[] }, Error>}
        skeleton={<div>Skeleton</div>}
      >
        {() => <div>Content</div>}
      </ProxyQueryWrapper>,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('renders children with data when query succeeds', () => {
    const query = makeQuery({ data: { items: ['task-1', 'task-2'] } });

    render(
      <ProxyQueryWrapper
        query={query as UseQueryResult<{ items: string[] }, Error>}
        skeleton={<div>Skeleton</div>}
      >
        {(data) => <ul>{data.items.map((i) => <li key={i}>{i}</li>)}</ul>}
      </ProxyQueryWrapper>,
    );

    expect(screen.getByText('task-1')).toBeInTheDocument();
    expect(screen.getByText('task-2')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton')).not.toBeInTheDocument();
  });

  it('renders skeleton when data is undefined (not yet loaded)', () => {
    const query = makeQuery({ isLoading: false, data: undefined });

    render(
      <ProxyQueryWrapper
        query={query as UseQueryResult<{ items: string[] }, Error>}
        skeleton={<div data-testid="skeleton">Skeleton</div>}
      >
        {() => <div>Content</div>}
      </ProxyQueryWrapper>,
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
