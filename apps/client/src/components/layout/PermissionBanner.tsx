import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useTransport } from '../../contexts/TransportContext';

const DEFAULT_MESSAGE = 'Permissions bypassed - all tool calls auto-approved';

const WITTY_MESSAGES = [
  'Permissions bypassed - you like living dangerously',
  "Permissions bypassed - you're running with scissors",
  'Permissions bypassed - YOLO mode engaged',
  'Permissions bypassed - no safety net',
  'Permissions bypassed - what could go wrong?',
  'Permissions bypassed - hold onto your files',
  "Permissions bypassed - I hope you trust me",
  'Permissions bypassed - send it',
] as const;

/** How long a witty message shows before reverting (ms). */
const WITTY_DISPLAY_MS = 4000;
/** How long the default message shows before swapping to a witty one (ms). */
const DEFAULT_DISPLAY_MS = 12000;

export function PermissionBanner({ sessionId }: { sessionId: string | null }) {
  const transport = useTransport();
  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => transport.getSession(sessionId!),
    enabled: !!sessionId,
  });

  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [key, setKey] = useState(0);
  const isDefault = message === DEFAULT_MESSAGE;

  const showWitty = useCallback(() => {
    const msg = WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)];
    setMessage(msg);
    setKey((k) => k + 1);
  }, []);

  const showDefault = useCallback(() => {
    setMessage(DEFAULT_MESSAGE);
    setKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!session || session.permissionMode !== 'bypassPermissions') return;

    const timeout = setTimeout(
      isDefault ? showWitty : showDefault,
      isDefault ? DEFAULT_DISPLAY_MS : WITTY_DISPLAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [session, isDefault, showWitty, showDefault]);

  if (!session || session.permissionMode !== 'bypassPermissions') return null;

  return (
    <div className="bg-red-600 text-white text-center text-sm py-1 px-4 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="inline-block"
        >
          {message}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
