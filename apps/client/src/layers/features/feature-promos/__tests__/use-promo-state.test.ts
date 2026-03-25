import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia (needed by app store init)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock font-related imports to prevent side effects
vi.mock('@/layers/shared/lib', async () => {
  const actual = await vi.importActual('@/layers/shared/lib');
  return {
    ...actual,
    loadGoogleFont: vi.fn(),
    removeGoogleFont: vi.fn(),
    applyFontCSS: vi.fn(),
    removeFontCSS: vi.fn(),
    getFontConfig: () => ({ key: 'system', sans: '', mono: '', googleFontsUrl: '' }),
    isValidFontKey: () => false,
  };
});

import { useAppStore } from '@/layers/shared/model';

describe('promo state in app store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset store state
    useAppStore.setState({
      dismissedPromoIds: [],
      promoEnabled: true,
    });
  });

  describe('dismissPromo', () => {
    it('adds ID to dismissedPromoIds', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.dismissPromo('test-promo');
      });
      expect(result.current.dismissedPromoIds).toContain('test-promo');
    });

    it('is idempotent - dismissing twice does not duplicate', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.dismissPromo('test-promo');
        result.current.dismissPromo('test-promo');
      });
      expect(result.current.dismissedPromoIds.filter((id) => id === 'test-promo')).toHaveLength(1);
    });

    it('persists to localStorage', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.dismissPromo('test-promo');
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dorkos-dismissed-promo-ids',
        JSON.stringify(['test-promo'])
      );
    });

    it('accumulates multiple dismissed IDs', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.dismissPromo('promo-a');
      });
      act(() => {
        result.current.dismissPromo('promo-b');
      });
      expect(result.current.dismissedPromoIds).toEqual(['promo-a', 'promo-b']);
    });
  });

  describe('setPromoEnabled', () => {
    it('toggles the global flag', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.promoEnabled).toBe(true);
      act(() => {
        result.current.setPromoEnabled(false);
      });
      expect(result.current.promoEnabled).toBe(false);
    });

    it('persists to localStorage', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.setPromoEnabled(false);
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('dorkos-promo-enabled', 'false');
    });
  });

  describe('resetPreferences', () => {
    it('resets dismissedPromoIds to empty array', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.dismissPromo('test-promo');
      });
      act(() => {
        result.current.resetPreferences();
      });
      expect(result.current.dismissedPromoIds).toEqual([]);
    });

    it('resets promoEnabled to true', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.setPromoEnabled(false);
      });
      act(() => {
        result.current.resetPreferences();
      });
      expect(result.current.promoEnabled).toBe(true);
    });

    it('removes dismissed promo IDs from localStorage', () => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.dismissPromo('test-promo');
      });
      act(() => {
        result.current.resetPreferences();
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('dorkos-dismissed-promo-ids');
    });
  });
});
