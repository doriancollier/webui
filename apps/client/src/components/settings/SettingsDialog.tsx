import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTransport } from '@/contexts/TransportContext';
import { useAppStore } from '@/stores/app-store';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const {
    showTimestamps, setShowTimestamps,
    expandToolCalls, setExpandToolCalls,
    autoHideToolCalls, setAutoHideToolCalls,
    devtoolsOpen, toggleDevtools,
    verboseLogging, setVerboseLogging,
    fontSize, setFontSize,
    resetPreferences,
  } = useAppStore();

  const transport = useTransport();
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => transport.getConfig(),
    staleTime: 30_000,
    enabled: open,
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg p-0 gap-0">
        <ResponsiveDialogHeader className="px-4 py-3 border-b space-y-0">
          <ResponsiveDialogTitle className="text-sm font-medium">Settings</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="overflow-y-auto flex-1 p-4 space-y-6">
          {/* Preferences Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
              <button
                onClick={() => { resetPreferences(); setTheme('system'); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Reset to defaults
              </button>
            </div>

            <SettingRow label="Theme" description="Choose your preferred color scheme">
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow label="Font size" description="Adjust the text size across the interface">
              <Select value={fontSize} onValueChange={(v) => setFontSize(v as 'small' | 'medium' | 'large')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow label="Show timestamps" description="Display message timestamps in chat">
              <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
            </SettingRow>

            <SettingRow label="Expand tool calls" description="Auto-expand tool call details in messages">
              <Switch checked={expandToolCalls} onCheckedChange={setExpandToolCalls} />
            </SettingRow>

            <SettingRow label="Auto-hide tool calls" description="Fade out completed tool calls after a few seconds">
              <Switch checked={autoHideToolCalls} onCheckedChange={setAutoHideToolCalls} />
            </SettingRow>

            <SettingRow label="Show dev tools" description="Enable developer tools panel">
              <Switch checked={devtoolsOpen} onCheckedChange={() => toggleDevtools()} />
            </SettingRow>

            <SettingRow label="Verbose logging" description="Show detailed logs in the console">
              <Switch checked={verboseLogging} onCheckedChange={setVerboseLogging} />
            </SettingRow>
          </div>

          <Separator />

          {/* Server Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Server</h3>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : config ? (
              <div className="space-y-1">
                <ConfigRow label="Version" value={config.version} />
                <ConfigRow label="Port" value={String(config.port)} />
                <ConfigRow label="Uptime" value={formatUptime(config.uptime)} />
                <ConfigRow label="Working Directory" value={config.workingDirectory} mono truncate />
                <ConfigRow label="Node.js" value={config.nodeVersion} />
                <ConfigRow
                  label="Claude CLI"
                  value={config.claudeCliPath || 'Not found'}
                  mono
                  truncate
                  muted={!config.claudeCliPath}
                />

                <ConfigBadgeRow
                  label="Tunnel"
                  value={config.tunnel.enabled ? 'Enabled' : 'Disabled'}
                  variant={config.tunnel.enabled ? 'default' : 'secondary'}
                />

                {config.tunnel.enabled && (
                  <>
                    <ConfigBadgeRow
                      label="Tunnel Status"
                      value={config.tunnel.connected ? 'Connected' : 'Disconnected'}
                      variant={config.tunnel.connected ? 'default' : 'secondary'}
                    />

                    {config.tunnel.url && (
                      <ConfigRow label="Tunnel URL" value={config.tunnel.url} mono />
                    )}

                    <ConfigRow
                      label="Tunnel Auth"
                      value={config.tunnel.authEnabled ? 'Enabled' : 'Disabled'}
                    />

                    <ConfigBadgeRow
                      label="ngrok Token"
                      value={config.tunnel.tokenConfigured ? 'Configured' : 'Not configured'}
                      variant={config.tunnel.tokenConfigured ? 'default' : 'secondary'}
                    />
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, []);
  return { copied, copy };
}

function ConfigRow({
  label,
  value,
  mono,
  truncate,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  muted?: boolean;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className="flex w-full items-center justify-between py-1 gap-4 rounded -mx-1 px-1 hover:bg-muted/50 active:bg-muted/70 transition-colors duration-100"
    >
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {copied ? (
        <span className="text-xs text-muted-foreground">Copied</span>
      ) : (
        <span
          className={cn(
            'text-sm text-right',
            mono && 'font-mono',
            truncate && 'min-w-0 max-w-48 truncate',
            muted && 'text-muted-foreground',
          )}
          dir={truncate ? 'rtl' : undefined}
          title={value}
        >
          {value}
        </span>
      )}
    </button>
  );
}

function ConfigBadgeRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'default' | 'secondary';
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className="flex w-full items-center justify-between py-1 rounded -mx-1 px-1 hover:bg-muted/50 active:bg-muted/70 transition-colors duration-100"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {copied ? (
        <span className="text-xs text-muted-foreground">Copied</span>
      ) : (
        <Badge variant={variant}>{value}</Badge>
      )}
    </button>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
