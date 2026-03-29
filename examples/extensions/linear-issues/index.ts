import React from 'react';
import type { ExtensionAPI } from '@dorkos/extension-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a single Linear issue from the GraphQL API. */
interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  state?: { name: string; type: string; color: string };
  team?: { key: string; name: string };
  project?: { name: string };
  updatedAt: string;
}

/** Shape of a secret entry returned by the secrets API. */
interface SecretEntry {
  key: string;
  isSet: boolean;
}

// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------

/**
 * Linear Issues extension — shows the authenticated user's active Linear
 * issues on the DorkOS dashboard, with a settings tab for API key entry.
 *
 * To install:
 * 1. Copy this directory to ~/.dork/extensions/linear-issues/
 * 2. Open DorkOS Settings > Extensions
 * 3. Enable "Linear Issues"
 * 4. Configure your Linear API key in the extension's Settings tab
 */
export function activate(api: ExtensionAPI): () => void {
  // Dashboard section showing compact issue list
  const unregisterSection = api.registerComponent(
    'dashboard.sections',
    'linear-issues-section',
    LinearIssuesSection,
    { priority: 6 }
  );

  // Settings tab for API key management
  const unregisterSettings = api.registerSettingsTab(
    'linear-issues-settings',
    'Linear Issues',
    LinearIssuesSettings,
  );

  return () => {
    unregisterSection();
    unregisterSettings();
  };
}

// ---------------------------------------------------------------------------
// Dashboard Section
// ---------------------------------------------------------------------------

function LinearIssuesSection() {
  const [issues, setIssues] = React.useState<LinearIssue[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await fetch('/api/ext/linear-issues/cached');
        const data = await res.json();
        setIssues(data?.data?.data?.viewer?.assignedIssues?.nodes ?? []);
      } catch (err: unknown) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
    const interval = setInterval(fetchIssues, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return React.createElement('div', { style: styles.card }, 'Loading issues...');
  }
  if (error) {
    return React.createElement('div', { style: styles.card }, `Error: ${error}`);
  }
  if (!issues?.length) {
    return React.createElement('div', { style: styles.card }, 'No active issues');
  }

  return React.createElement(
    'div',
    { style: styles.card },
    React.createElement('h3', { style: styles.heading }, 'Linear Issues'),
    React.createElement(
      'div',
      { style: styles.list },
      issues.map((issue) =>
        React.createElement(IssueRow, { key: issue.id, issue }),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Issue Row
// ---------------------------------------------------------------------------

function IssueRow({ issue }: { issue: LinearIssue }) {
  return React.createElement(
    'div',
    { style: styles.issueRow },
    React.createElement('span', {
      style: { ...styles.statusDot, backgroundColor: issue.state?.color ?? '#888' },
    }),
    React.createElement('span', { style: styles.identifier }, issue.identifier),
    React.createElement('span', { style: styles.title }, issue.title),
    React.createElement('span', { style: styles.team }, issue.team?.key),
  );
}

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

function LinearIssuesSettings() {
  const [apiKey, setApiKey] = React.useState('');
  const [isSet, setIsSet] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/extensions/linear-issues/secrets')
      .then((r) => r.json())
      .then((secrets: SecretEntry[]) => {
        const s = secrets.find((entry) => entry.key === 'linear_api_key');
        if (s) setIsSet(s.isSet);
      });
  }, []);

  const handleSave = async () => {
    await fetch('/api/extensions/linear-issues/secrets/linear_api_key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: apiKey }),
    });
    setIsSet(true);
    setApiKey('');
  };

  return React.createElement(
    'div',
    { style: { padding: '16px' } },
    React.createElement('h3', null, 'Linear API Key'),
    React.createElement(
      'p',
      { style: { color: 'var(--muted-foreground)', marginBottom: '8px' } },
      'Get your key at Settings \u2192 API \u2192 Personal API keys on linear.app',
    ),
    isSet
      ? React.createElement(
          'div',
          null,
          React.createElement('span', null, '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'),
          React.createElement(
            'button',
            { onClick: () => setIsSet(false), style: styles.clearBtn },
            'Clear',
          ),
        )
      : React.createElement(
          'div',
          null,
          React.createElement('input', {
            type: 'password',
            value: apiKey,
            onInput: (e: React.FormEvent<HTMLInputElement>) =>
              setApiKey(e.currentTarget.value),
            placeholder: 'lin_api_...',
            style: styles.input,
          }),
          React.createElement(
            'button',
            { onClick: handleSave, style: styles.saveBtn },
            'Save',
          ),
        ),
  );
}

// ---------------------------------------------------------------------------
// Styles — uses CSS custom properties from the host theme
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    marginBottom: '12px',
  },
  heading: { margin: '0 0 12px', fontSize: '14px', fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: '6px' },
  issueRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  identifier: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--muted-foreground)',
    fontSize: '12px',
    flexShrink: 0,
  },
  title: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  team: {
    marginLeft: 'auto',
    fontSize: '11px',
    color: 'var(--muted-foreground)',
    flexShrink: 0,
  },
  input: {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    marginRight: '8px',
  },
  saveBtn: {
    padding: '6px 12px',
    borderRadius: '4px',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    border: 'none',
    cursor: 'pointer',
  },
  clearBtn: {
    marginLeft: '8px',
    color: 'var(--destructive)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};
