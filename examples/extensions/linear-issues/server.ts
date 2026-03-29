import type { ServerExtensionRegister } from '@dorkos/extension-api/server';

const LINEAR_API = 'https://api.linear.app/graphql';

const MY_ISSUES_QUERY = `
  query MyIssues {
    viewer {
      assignedIssues(
        first: 50,
        filter: { state: { type: { nin: ["completed", "canceled"] } } }
      ) {
        nodes {
          id
          identifier
          title
          priority
          state { name type color }
          team { key name }
          project { name }
          updatedAt
        }
      }
    }
  }
`;

/** Fetch the authenticated user's active issues from the Linear GraphQL API. */
async function fetchIssues(apiKey: string): Promise<unknown> {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: MY_ISSUES_QUERY }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  return res.json();
}

const register: ServerExtensionRegister = (router, ctx) => {
  // On-demand endpoint — fresh data from Linear
  router.get('/issues', async (req, res) => {
    const apiKey = await ctx.secrets.get('linear_api_key');
    if (!apiKey) {
      return res.status(503).json({ error: 'Linear API key not configured' });
    }
    try {
      const data = await fetchIssues(apiKey);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: String(err) });
    }
  });

  // Cached data endpoint — returns last polled result
  router.get('/cached', async (_req, res) => {
    const cached = await ctx.storage.loadData();
    res.json(cached ?? { data: null });
  });

  // Background polling — every 60 seconds
  ctx.schedule(60, async () => {
    const apiKey = await ctx.secrets.get('linear_api_key');
    if (!apiKey) return;
    try {
      const data = await fetchIssues(apiKey);
      const prev = await ctx.storage.loadData<{ hash?: string }>();
      const hash = JSON.stringify(data);
      if (hash !== prev?.hash) {
        await ctx.storage.saveData({ data, hash, updatedAt: Date.now() });
        ctx.emit('issues.updated', data);
      }
    } catch (err) {
      console.error('[linear-issues] Polling error:', err);
    }
  });
};

export default register;
