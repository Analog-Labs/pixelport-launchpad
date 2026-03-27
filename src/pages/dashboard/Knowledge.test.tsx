import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Knowledge from './Knowledge';
import { KnowledgeConflictError } from '@/hooks/useKnowledgeMirror';
import type { KnowledgeFileKey, KnowledgeSection, KnowledgeSyncSummary } from '@/lib/knowledge-mirror';

const { useKnowledgeMirrorMock } = vi.hoisted(() => ({
  useKnowledgeMirrorMock: vi.fn(),
}));

vi.mock('@/hooks/useKnowledgeMirror', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useKnowledgeMirror')>(
    '@/hooks/useKnowledgeMirror',
  );
  return {
    ...actual,
    useKnowledgeMirror: useKnowledgeMirrorMock,
  };
});

function buildSections(): KnowledgeSection[] {
  return [
    {
      key: 'knowledge/company-overview.md',
      title: 'Company Overview',
      content: '# Company Overview\n\nAcme Labs.',
    },
    {
      key: 'knowledge/products-and-offers.md',
      title: 'Products and Offers',
      content: '# Products\n\nStarter package.',
    },
    {
      key: 'knowledge/audience-and-icp.md',
      title: 'Audience and ICP',
      content: '# Audience\n\nB2B founders.',
    },
    {
      key: 'knowledge/brand-voice.md',
      title: 'Brand Voice',
      content: '# Voice\n\nClear and direct.',
    },
    {
      key: 'knowledge/competitors.md',
      title: 'Competitors',
      content: '# Competitors\n\nCompetitor A.',
    },
  ];
}

function buildSyncSummary(status: KnowledgeSyncSummary['status']): KnowledgeSyncSummary {
  return {
    status,
    revision: 3,
    synced_revision: status === 'synced' ? 3 : 2,
    seeded_revision: 1,
    last_synced_at: status === 'synced' ? '2026-03-27T05:00:00.000Z' : null,
    last_error: status === 'failed' ? 'Runtime host unavailable' : null,
    updated_at: '2026-03-27T05:00:00.000Z',
  };
}

type HookState = ReturnType<typeof useKnowledgeMirrorMock>;

function buildHookState(overrides: Partial<HookState> = {}): HookState {
  const sections = buildSections();
  const fileMap = Object.fromEntries(sections.map((section) => [section.key, section.content])) as Record<
    KnowledgeFileKey,
    string
  >;

  return {
    tenantLoading: false,
    mirror: {
      revision: 3,
      files: fileMap,
      sync: buildSyncSummary('synced'),
    },
    sections,
    syncSummary: buildSyncSummary('synced'),
    statusQuery: {
      isLoading: false,
      isError: false,
      data: buildSyncSummary('synced'),
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    },
    saveSection: vi.fn().mockResolvedValue({ success: true }),
    retrySync: vi.fn().mockResolvedValue({ success: true }),
    saveMutation: { isPending: false },
    retryMutation: { isPending: false },
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Knowledge page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pending sync rail and section cards', () => {
    useKnowledgeMirrorMock.mockReturnValue(
      buildHookState({
        syncSummary: buildSyncSummary('pending'),
        statusQuery: {
          isLoading: false,
          isError: false,
          data: buildSyncSummary('pending'),
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        },
      }),
    );

    render(<Knowledge />);

    expect(screen.getByRole('heading', { name: 'Knowledge' })).toBeInTheDocument();
    expect(screen.getByText('Sync in progress')).toBeInTheDocument();
    expect(screen.getAllByText('Company Overview').length).toBeGreaterThan(0);
    expect(screen.getByText('Products and Offers')).toBeInTheDocument();
  });

  it('supports edit and save, with save disabled until content is dirty', async () => {
    const saveSectionMock = vi.fn().mockResolvedValue({ success: true });
    useKnowledgeMirrorMock.mockReturnValue(
      buildHookState({
        saveSection: saveSectionMock,
      }),
    );

    render(<Knowledge />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    const editor = screen.getByRole('textbox');
    expect(saveButton).toBeDisabled();

    fireEvent.change(editor, {
      target: { value: '# Company Overview\n\nUpdated company context.' },
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(saveSectionMock).toHaveBeenCalledWith({
        fileKey: 'knowledge/company-overview.md',
        content: '# Company Overview\n\nUpdated company context.',
        expectedRevision: 3,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('shows conflict guidance and refreshes latest data on 409 save conflict', async () => {
    const refreshMock = vi.fn().mockResolvedValue(undefined);
    const saveSectionMock = vi
      .fn()
      .mockRejectedValue(
        new KnowledgeConflictError({
          expectedRevision: 3,
          currentRevision: 4,
          message: 'Conflict',
        }),
      );

    useKnowledgeMirrorMock.mockReturnValue(
      buildHookState({
        saveSection: saveSectionMock,
        refresh: refreshMock,
      }),
    );

    render(<Knowledge />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '# Company Overview\n\nConflict text' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(
      screen.getByText('This section changed elsewhere. We reloaded the latest version. Review and save again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows failed sync state and triggers manual retry', async () => {
    const retrySyncMock = vi.fn().mockResolvedValue({ success: true });
    useKnowledgeMirrorMock.mockReturnValue(
      buildHookState({
        syncSummary: buildSyncSummary('failed'),
        statusQuery: {
          isLoading: false,
          isError: false,
          data: buildSyncSummary('failed'),
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        },
        retrySync: retrySyncMock,
      }),
    );

    render(<Knowledge />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry Sync' }));

    await waitFor(() => expect(retrySyncMock).toHaveBeenCalledWith(3));
    expect(screen.getByText('Sync failed')).toBeInTheDocument();
  });

  it('shows full-page error with retry when status fetch fails', () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    useKnowledgeMirrorMock.mockReturnValue(
      buildHookState({
        statusQuery: {
          isLoading: false,
          isError: true,
          data: null,
          error: new Error('Status endpoint down'),
          refetch: refetchMock,
        },
      }),
    );

    render(<Knowledge />);

    expect(screen.getByText('Could not load Knowledge right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
