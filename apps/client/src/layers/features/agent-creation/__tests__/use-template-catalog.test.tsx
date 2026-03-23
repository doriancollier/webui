/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TransportProvider } from '@/layers/shared/model';
import { createMockTransport } from '@dorkos/test-utils';
import type { TemplateEntry } from '@dorkos/shared/template-catalog';
import { useTemplateCatalog } from '../model/use-template-catalog';

const MOCK_TEMPLATES: TemplateEntry[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty agent workspace',
    source: '',
    category: 'general',
    builtin: true,
    tags: ['starter'],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Next.js 15 starter with App Router',
    source: 'github:dorkos-templates/nextjs',
    category: 'frontend',
    builtin: true,
    tags: ['react', 'ssr'],
  },
];

function createWrapper(transport = createMockTransport()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    transport,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TransportProvider transport={transport}>{children}</TransportProvider>
      </QueryClientProvider>
    ),
  };
}

describe('useTemplateCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns template list from transport', async () => {
    const { transport, wrapper } = createWrapper();
    vi.mocked(transport.getTemplates).mockResolvedValue(MOCK_TEMPLATES);

    const { result } = renderHook(() => useTemplateCatalog(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(MOCK_TEMPLATES);
    expect(result.current.data).toHaveLength(2);
    expect(transport.getTemplates).toHaveBeenCalledOnce();
  });

  it('is in loading state while fetching', () => {
    const { transport, wrapper } = createWrapper();
    vi.mocked(transport.getTemplates).mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useTemplateCatalog(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('handles error gracefully', async () => {
    const { transport, wrapper } = createWrapper();
    vi.mocked(transport.getTemplates).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTemplateCatalog(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.data).toBeUndefined();
  });

  it('uses 5-minute staleTime', async () => {
    const { transport, wrapper } = createWrapper();
    vi.mocked(transport.getTemplates).mockResolvedValue(MOCK_TEMPLATES);

    const { result, rerender } = renderHook(() => useTemplateCatalog(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Re-render should use cached data without re-fetching
    rerender();

    expect(transport.getTemplates).toHaveBeenCalledOnce();
  });
});
