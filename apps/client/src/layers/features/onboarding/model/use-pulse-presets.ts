import { useQuery } from '@tanstack/react-query';

/** A single Pulse schedule preset returned by the server. */
export interface PulsePreset {
  id: string;
  name: string;
  description: string;
  cron: string;
  prompt: string;
}

/** Fetch available Pulse schedule presets for onboarding. */
export function usePulsePresets() {
  return useQuery<PulsePreset[]>({
    queryKey: ['pulse', 'presets'],
    queryFn: async () => {
      const res = await fetch('/api/pulse/presets');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    },
  });
}
