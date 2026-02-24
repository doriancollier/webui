import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRelayRouter } from '../relay.js';
import type { RelayCore } from '@dorkos/relay';

function createMockRelayCore(): RelayCore {
  return {
    publish: vi.fn().mockResolvedValue({ messageId: 'msg-1', deliveredTo: 1 }),
    listMessages: vi.fn().mockReturnValue({ messages: [], nextCursor: undefined }),
    getMessage: vi.fn().mockReturnValue(null),
    listEndpoints: vi.fn().mockReturnValue([]),
    registerEndpoint: vi.fn().mockResolvedValue({
      subject: 'relay.test.endpoint',
      hash: 'abc123',
      maildirPath: '/tmp/maildir/abc123',
    }),
    unregisterEndpoint: vi.fn().mockResolvedValue(true),
    readInbox: vi.fn().mockReturnValue({ messages: [], nextCursor: undefined }),
    getDeadLetters: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockReturnValue({ totalMessages: 0, byStatus: {}, bySubject: [] }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    onSignal: vi.fn().mockReturnValue(() => {}),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as RelayCore;
}

describe('Relay routes', () => {
  let app: express.Application;
  let relayCore: ReturnType<typeof createMockRelayCore>;

  beforeEach(() => {
    relayCore = createMockRelayCore();
    app = express();
    app.use(express.json());
    app.use('/api/relay', createRelayRouter(relayCore as unknown as RelayCore));
    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: err.message });
      },
    );
  });

  describe('POST /api/relay/messages', () => {
    it('publishes a message and returns result', async () => {
      const res = await request(app).post('/api/relay/messages').send({
        subject: 'relay.test.topic',
        payload: { hello: 'world' },
        from: 'relay.agent.sender',
      });

      expect(res.status).toBe(200);
      expect(res.body.messageId).toBe('msg-1');
      expect(res.body.deliveredTo).toBe(1);
      expect(vi.mocked(relayCore.publish)).toHaveBeenCalledWith(
        'relay.test.topic',
        { hello: 'world' },
        expect.objectContaining({ from: 'relay.agent.sender' }),
      );
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app).post('/api/relay/messages').send({ payload: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns 422 when publish throws', async () => {
      const error = new Error('Access denied');
      (error as Error & { code: string }).code = 'ACCESS_DENIED';
      vi.mocked(relayCore.publish).mockRejectedValue(error);

      const res = await request(app).post('/api/relay/messages').send({
        subject: 'relay.test.topic',
        payload: {},
        from: 'relay.agent.sender',
      });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Access denied');
      expect(res.body.code).toBe('ACCESS_DENIED');
    });
  });

  describe('GET /api/relay/messages', () => {
    it('returns messages list', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          subject: 'relay.test',
          sender: 'agent-a',
          endpointHash: 'h1',
          status: 'new' as const,
          createdAt: '2026-02-24T00:00:00Z',
          ttl: Date.now() + 60000,
        },
      ];
      vi.mocked(relayCore.listMessages).mockReturnValue({
        messages: mockMessages,
        nextCursor: undefined,
      });

      const res = await request(app).get('/api/relay/messages');

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].id).toBe('msg-1');
    });

    it('passes query filters to listMessages', async () => {
      await request(app).get('/api/relay/messages?subject=relay.test&status=new&limit=10');

      expect(vi.mocked(relayCore.listMessages)).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'relay.test', status: 'new', limit: 10 }),
      );
    });

    it('returns 400 for invalid status filter', async () => {
      const res = await request(app).get('/api/relay/messages?status=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/relay/messages/:id', () => {
    it('returns a message when found', async () => {
      vi.mocked(relayCore.getMessage).mockReturnValue({
        id: 'msg-1',
        subject: 'relay.test',
        sender: 'agent-a',
        endpointHash: 'h1',
        status: 'new',
        createdAt: '2026-02-24T00:00:00Z',
        ttl: Date.now() + 60000,
      });

      const res = await request(app).get('/api/relay/messages/msg-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('msg-1');
    });

    it('returns 404 when message not found', async () => {
      const res = await request(app).get('/api/relay/messages/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Message not found');
    });
  });

  describe('GET /api/relay/endpoints', () => {
    it('returns endpoint list', async () => {
      vi.mocked(relayCore.listEndpoints).mockReturnValue([
        { subject: 'relay.system.console', hash: 'abc', maildirPath: '/tmp/m/abc', registeredAt: '2026-02-24T00:00:00Z' },
      ]);

      const res = await request(app).get('/api/relay/endpoints');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].subject).toBe('relay.system.console');
    });
  });

  describe('POST /api/relay/endpoints', () => {
    it('registers an endpoint', async () => {
      const res = await request(app)
        .post('/api/relay/endpoints')
        .send({ subject: 'relay.agent.new' });

      expect(res.status).toBe(201);
      expect(res.body.subject).toBe('relay.test.endpoint');
      expect(vi.mocked(relayCore.registerEndpoint)).toHaveBeenCalledWith('relay.agent.new');
    });

    it('returns 400 for missing subject', async () => {
      const res = await request(app).post('/api/relay/endpoints').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns 422 when registration fails', async () => {
      vi.mocked(relayCore.registerEndpoint).mockRejectedValue(new Error('Duplicate endpoint'));

      const res = await request(app)
        .post('/api/relay/endpoints')
        .send({ subject: 'relay.agent.dup' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Duplicate endpoint');
    });
  });

  describe('DELETE /api/relay/endpoints/:subject', () => {
    it('removes an endpoint', async () => {
      const res = await request(app).delete('/api/relay/endpoints/relay.agent.old');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when endpoint not found', async () => {
      vi.mocked(relayCore.unregisterEndpoint).mockResolvedValue(false);

      const res = await request(app).delete('/api/relay/endpoints/relay.agent.nope');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Endpoint not found');
    });
  });

  describe('GET /api/relay/endpoints/:subject/inbox', () => {
    it('returns inbox messages', async () => {
      vi.mocked(relayCore.readInbox).mockReturnValue({
        messages: [
          {
            id: 'msg-1',
            subject: 'relay.test',
            sender: 'agent-a',
            endpointHash: 'h1',
            status: 'new',
            createdAt: '2026-02-24T00:00:00Z',
            ttl: Date.now() + 60000,
          },
        ],
      });

      const res = await request(app).get('/api/relay/endpoints/relay.test/inbox');

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
    });

    it('returns 404 when endpoint not found', async () => {
      const error = new Error('Endpoint not found: relay.nope');
      (error as Error & { code: string }).code = 'ENDPOINT_NOT_FOUND';
      vi.mocked(relayCore.readInbox).mockImplementation(() => {
        throw error;
      });

      const res = await request(app).get('/api/relay/endpoints/relay.nope/inbox');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Endpoint not found');
    });
  });

  describe('GET /api/relay/dead-letters', () => {
    it('returns dead letters', async () => {
      vi.mocked(relayCore.getDeadLetters).mockResolvedValue([
        {
          endpointHash: 'h1',
          messageId: 'msg-1',
          reason: 'no matching endpoints',
          envelope: {} as never,
          failedAt: '2026-02-24T00:00:00Z',
        },
      ]);

      const res = await request(app).get('/api/relay/dead-letters');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('passes endpointHash filter', async () => {
      await request(app).get('/api/relay/dead-letters?endpointHash=abc123');

      expect(vi.mocked(relayCore.getDeadLetters)).toHaveBeenCalledWith({ endpointHash: 'abc123' });
    });
  });

  describe('GET /api/relay/metrics', () => {
    it('returns metrics', async () => {
      vi.mocked(relayCore.getMetrics).mockReturnValue({
        totalMessages: 42,
        byStatus: { new: 10, cur: 30, failed: 2 },
        bySubject: [{ subject: 'relay.test', count: 42 }],
      });

      const res = await request(app).get('/api/relay/metrics');

      expect(res.status).toBe(200);
      expect(res.body.totalMessages).toBe(42);
      expect(res.body.byStatus.new).toBe(10);
    });
  });
});
