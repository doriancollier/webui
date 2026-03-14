import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleTypingSignal, clearAllTypingIntervals } from '../outbound.js';
import type { Bot } from 'grammy';

// Mock inbound.js for extractChatId and constants
vi.mock('../inbound.js', () => ({
  SUBJECT_PREFIX: 'relay.human.telegram',
  MAX_MESSAGE_LENGTH: 4096,
  extractChatId: (subject: string) => {
    const parts = subject.split('.');
    const chatIdStr = parts[parts.length - 1];
    if (!chatIdStr) return null;
    const num = Number(chatIdStr);
    return Number.isNaN(num) ? null : num;
  },
}));

const mockSendChatAction = vi.fn().mockResolvedValue(true);

function buildMockBot(): Bot {
  return {
    api: {
      sendChatAction: mockSendChatAction,
    },
  } as unknown as Bot;
}

describe('typing indicator -- interval refresh', () => {
  let bot: Bot;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    bot = buildMockBot();
  });

  afterEach(() => {
    clearAllTypingIntervals();
    vi.useRealTimers();
  });

  it('calls sendChatAction immediately on active signal', async () => {
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'active');
    expect(mockSendChatAction).toHaveBeenCalledTimes(1);
    expect(mockSendChatAction).toHaveBeenCalledWith(12345, 'typing');
  });

  it('refreshes sendChatAction every 4 seconds', async () => {
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'active');
    expect(mockSendChatAction).toHaveBeenCalledTimes(1);

    // Advance 4 seconds -- first interval tick
    await vi.advanceTimersByTimeAsync(4_000);
    expect(mockSendChatAction).toHaveBeenCalledTimes(2);

    // Advance another 4 seconds -- second interval tick
    await vi.advanceTimersByTimeAsync(4_000);
    expect(mockSendChatAction).toHaveBeenCalledTimes(3);
  });

  it('clears interval on non-active signal', async () => {
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'active');
    expect(mockSendChatAction).toHaveBeenCalledTimes(1);

    // Stop typing
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'stopped');

    // Advance time -- should NOT trigger additional calls
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  });

  it('clears interval when sendChatAction fails', async () => {
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'active');

    // Make the interval tick fail
    mockSendChatAction.mockRejectedValueOnce(new Error('chat not found'));
    await vi.advanceTimersByTimeAsync(4_000);

    // Should not call again after failure
    await vi.advanceTimersByTimeAsync(4_000);
    // 3 total: 1 immediate + 1 failed interval + 0 after clear
    expect(mockSendChatAction).toHaveBeenCalledTimes(2);
  });

  it('replaces existing interval on repeated active signals', async () => {
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'active');
    await handleTypingSignal(bot, 'relay.human.telegram.12345', 'active');

    // Should have called immediately twice (once per active signal)
    expect(mockSendChatAction).toHaveBeenCalledTimes(2);

    // Only one interval should be running
    await vi.advanceTimersByTimeAsync(4_000);
    expect(mockSendChatAction).toHaveBeenCalledTimes(3);
  });

  it('does nothing when bot is null', async () => {
    await handleTypingSignal(null, 'relay.human.telegram.12345', 'active');
    expect(mockSendChatAction).not.toHaveBeenCalled();
  });

  it('clearAllTypingIntervals clears all active intervals', async () => {
    await handleTypingSignal(bot, 'relay.human.telegram.111', 'active');
    await handleTypingSignal(bot, 'relay.human.telegram.222', 'active');

    clearAllTypingIntervals();

    await vi.advanceTimersByTimeAsync(8_000);
    // Only the 2 immediate calls, no interval refreshes
    expect(mockSendChatAction).toHaveBeenCalledTimes(2);
  });
});
