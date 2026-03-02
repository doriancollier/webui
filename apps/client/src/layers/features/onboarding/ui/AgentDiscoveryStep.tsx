import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/layers/shared/ui';
import { useRegisterAgent } from '@/layers/entities/mesh';
import { useDiscoveryScan } from '../model/use-discovery-scan';
import { AgentCard } from './AgentCard';

interface AgentDiscoveryStepProps {
  onStepComplete: () => void;
}

/**
 * Step 1 of onboarding — discovers AI agent projects on the user's machine.
 *
 * Flows through three states: initial (start scan), scanning (progressive results),
 * and results (selection + confirmation). All discovered agents are selected by default.
 *
 * @param onStepComplete - Called when the user confirms their agent selection
 */
export function AgentDiscoveryStep({ onStepComplete }: AgentDiscoveryStepProps) {
  const { candidates, isScanning, progress, error, startScan } = useDiscoveryScan();
  const registerAgent = useRegisterAgent();
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [hasScanned, setHasScanned] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Select all agents by default when scan completes
  useEffect(() => {
    if (!isScanning && candidates.length > 0 && !hasScanned) {
      setSelectedPaths(new Set(candidates.map((c) => c.path)));
      setHasScanned(true);
    }
  }, [isScanning, candidates, hasScanned]);

  // Also select newly arriving candidates during scanning
  useEffect(() => {
    if (isScanning && candidates.length > 0) {
      setSelectedPaths(new Set(candidates.map((c) => c.path)));
    }
  }, [isScanning, candidates]);

  const handleToggle = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleStartScan = useCallback(() => {
    setHasScanned(false);
    startScan();
  }, [startScan]);

  const handleConfirm = useCallback(async () => {
    setIsRegistering(true);
    const paths = Array.from(selectedPaths);
    try {
      await Promise.all(paths.map((p) => registerAgent.mutateAsync({ path: p })));
    } catch {
      // Continue even if some registrations fail — agents can be registered later
    } finally {
      setIsRegistering(false);
      onStepComplete();
    }
  }, [selectedPaths, registerAgent, onStepComplete]);

  const hasResults = candidates.length > 0;
  const showInitial = !isScanning && !hasResults && !hasScanned;
  const showNoResults = !isScanning && !hasResults && hasScanned;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 sm:px-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {showInitial ? "Let's find your agents" : 'Discovered Agents'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {showInitial &&
            'We will scan your machine for projects with AI agent configurations like CLAUDE.md, .cursor, and more.'}
          {isScanning && 'Scanning your projects...'}
          {showNoResults && 'No agent projects were found on your machine.'}
          {!isScanning &&
            hasResults &&
            `Found ${candidates.length} project${candidates.length === 1 ? '' : 's'}. Select the ones you want to register.`}
        </p>
      </div>

      {/* Progress indicator */}
      {isScanning && progress && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Scanned {progress.scannedDirs} directories &middot; Found {progress.foundAgents} agent
          {progress.foundAgents === 1 ? '' : 's'}
        </div>
      )}

      {/* Initial state — start scan button */}
      {showInitial && (
        <div className="mt-8">
          <Button size="lg" onClick={handleStartScan}>
            Start Scan
          </Button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Agent cards list */}
      {hasResults && (
        <div className="mt-8 w-full space-y-3">
          <AnimatePresence mode="popLayout">
            {candidates.map((candidate, index) => (
              <motion.div
                key={candidate.path}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  duration: 0.25,
                  delay: isScanning ? index * 0.1 : 0,
                  ease: 'easeOut',
                }}
              >
                <AgentCard
                  candidate={{ ...candidate, hasDorkManifest: false }}
                  selected={selectedPaths.has(candidate.path)}
                  onToggle={() => handleToggle(candidate.path)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* No results placeholder */}
      {showNoResults && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Try creating a CLAUDE.md file in one of your project directories and scanning again.</p>
          <div className="mt-4">
            <Button variant="outline" onClick={handleStartScan}>
              Scan Again
            </Button>
          </div>
        </div>
      )}

      {/* Confirm & Register button */}
      {!isScanning && hasResults && (
        <div className="mt-8">
          <Button size="lg" onClick={handleConfirm} disabled={selectedPaths.size === 0 || isRegistering}>
            {isRegistering ? 'Registering...' : `Confirm & Register (${selectedPaths.size})`}
          </Button>
        </div>
      )}
    </div>
  );
}
