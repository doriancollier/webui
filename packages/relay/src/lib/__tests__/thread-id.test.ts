import { describe, it, expect } from 'vitest';
import {
  TelegramThreadIdCodec,
  SlackThreadIdCodec,
  ChatSdkTelegramThreadIdCodec,
} from '../thread-id.js';
import type { ThreadIdCodec } from '../thread-id.js';

// === TelegramThreadIdCodec ===

describe('TelegramThreadIdCodec', () => {
  const codec: ThreadIdCodec = new TelegramThreadIdCodec();

  it('has the correct prefix', () => {
    expect(codec.prefix).toBe('relay.human.telegram');
  });

  describe('encode', () => {
    it('encodes a DM subject', () => {
      expect(codec.encode('123456789', 'dm')).toBe('relay.human.telegram.123456789');
    });

    it('encodes a group subject', () => {
      expect(codec.encode('-100987654321', 'group')).toBe(
        'relay.human.telegram.group.-100987654321'
      );
    });
  });

  describe('decode', () => {
    it('decodes a DM subject', () => {
      expect(codec.decode('relay.human.telegram.123456789')).toEqual({
        platformId: '123456789',
        channelType: 'dm',
      });
    });

    it('decodes a group subject', () => {
      expect(codec.decode('relay.human.telegram.group.-100987654321')).toEqual({
        platformId: '-100987654321',
        channelType: 'group',
      });
    });

    it('returns null for a non-matching prefix', () => {
      expect(codec.decode('relay.human.slack.123456789')).toBeNull();
    });

    it('returns null for a prefix-only subject with no chat ID', () => {
      expect(codec.decode('relay.human.telegram')).toBeNull();
    });

    it('returns null for a group prefix with no ID', () => {
      expect(codec.decode('relay.human.telegram.group.')).toBeNull();
    });

    it('returns null for an unrelated subject', () => {
      expect(codec.decode('relay.agent.outbound.some-id')).toBeNull();
    });

    it('round-trips a DM subject', () => {
      const platformId = '42';
      const subject = codec.encode(platformId, 'dm');
      expect(codec.decode(subject)).toEqual({ platformId, channelType: 'dm' });
    });

    it('round-trips a group subject', () => {
      const platformId = '-100123';
      const subject = codec.encode(platformId, 'group');
      expect(codec.decode(subject)).toEqual({ platformId, channelType: 'group' });
    });
  });
});

// === SlackThreadIdCodec ===

describe('SlackThreadIdCodec', () => {
  const codec: ThreadIdCodec = new SlackThreadIdCodec();

  it('has the correct prefix', () => {
    expect(codec.prefix).toBe('relay.human.slack');
  });

  describe('encode', () => {
    it('encodes a DM subject', () => {
      expect(codec.encode('D01234567', 'dm')).toBe('relay.human.slack.D01234567');
    });

    it('encodes a group subject', () => {
      expect(codec.encode('C09876543', 'group')).toBe('relay.human.slack.group.C09876543');
    });
  });

  describe('decode', () => {
    it('decodes a DM subject', () => {
      expect(codec.decode('relay.human.slack.D01234567')).toEqual({
        platformId: 'D01234567',
        channelType: 'dm',
      });
    });

    it('decodes a group subject', () => {
      expect(codec.decode('relay.human.slack.group.C09876543')).toEqual({
        platformId: 'C09876543',
        channelType: 'group',
      });
    });

    it('returns null for a non-matching prefix', () => {
      expect(codec.decode('relay.human.telegram.D01234567')).toBeNull();
    });

    it('returns null for a prefix-only subject with no channel ID', () => {
      expect(codec.decode('relay.human.slack')).toBeNull();
    });

    it('returns null for a group prefix with no ID', () => {
      expect(codec.decode('relay.human.slack.group.')).toBeNull();
    });

    it('returns null for an unrelated subject', () => {
      expect(codec.decode('relay.agent.outbound.some-id')).toBeNull();
    });

    it('round-trips a DM subject', () => {
      const platformId = 'D01234567';
      const subject = codec.encode(platformId, 'dm');
      expect(codec.decode(subject)).toEqual({ platformId, channelType: 'dm' });
    });

    it('round-trips a group subject', () => {
      const platformId = 'C09876543';
      const subject = codec.encode(platformId, 'group');
      expect(codec.decode(subject)).toEqual({ platformId, channelType: 'group' });
    });
  });
});

// === ChatSdkTelegramThreadIdCodec ===

describe('ChatSdkTelegramThreadIdCodec', () => {
  const codec: ThreadIdCodec = new ChatSdkTelegramThreadIdCodec();

  it('has the correct prefix', () => {
    expect(codec.prefix).toBe('relay.human.telegram-chatsdk');
  });

  describe('encode', () => {
    it('encodes a DM subject', () => {
      expect(codec.encode('111222333', 'dm')).toBe('relay.human.telegram-chatsdk.111222333');
    });

    it('encodes a group subject', () => {
      expect(codec.encode('-100555666777', 'group')).toBe(
        'relay.human.telegram-chatsdk.group.-100555666777'
      );
    });
  });

  describe('decode', () => {
    it('decodes a DM subject', () => {
      expect(codec.decode('relay.human.telegram-chatsdk.111222333')).toEqual({
        platformId: '111222333',
        channelType: 'dm',
      });
    });

    it('decodes a group subject', () => {
      expect(codec.decode('relay.human.telegram-chatsdk.group.-100555666777')).toEqual({
        platformId: '-100555666777',
        channelType: 'group',
      });
    });

    it('returns null for a non-matching prefix', () => {
      expect(codec.decode('relay.human.telegram.111222333')).toBeNull();
    });

    it('returns null for the native Telegram prefix (no cross-contamination)', () => {
      // Ensures the chatsdk codec does not accidentally match native Telegram subjects
      expect(codec.decode('relay.human.telegram.123')).toBeNull();
    });

    it('returns null for a prefix-only subject with no chat ID', () => {
      expect(codec.decode('relay.human.telegram-chatsdk')).toBeNull();
    });

    it('returns null for a group prefix with no ID', () => {
      expect(codec.decode('relay.human.telegram-chatsdk.group.')).toBeNull();
    });

    it('returns null for an unrelated subject', () => {
      expect(codec.decode('relay.agent.outbound.some-id')).toBeNull();
    });

    it('round-trips a DM subject', () => {
      const platformId = '777888999';
      const subject = codec.encode(platformId, 'dm');
      expect(codec.decode(subject)).toEqual({ platformId, channelType: 'dm' });
    });

    it('round-trips a group subject', () => {
      const platformId = '-100111222';
      const subject = codec.encode(platformId, 'group');
      expect(codec.decode(subject)).toEqual({ platformId, channelType: 'group' });
    });
  });
});

// === Prefix isolation ===

describe('Codec prefix isolation', () => {
  const telegram = new TelegramThreadIdCodec();
  const slack = new SlackThreadIdCodec();
  const chatSdk = new ChatSdkTelegramThreadIdCodec();

  it('each codec has a distinct prefix', () => {
    const prefixes = [telegram.prefix, slack.prefix, chatSdk.prefix];
    expect(new Set(prefixes).size).toBe(3);
  });

  it('Telegram codec does not decode Slack subjects', () => {
    expect(telegram.decode(slack.encode('C123', 'dm'))).toBeNull();
  });

  it('Slack codec does not decode Telegram subjects', () => {
    expect(slack.decode(telegram.encode('999', 'dm'))).toBeNull();
  });

  it('ChatSdk codec does not decode native Telegram subjects', () => {
    expect(chatSdk.decode(telegram.encode('999', 'group'))).toBeNull();
  });

  it('native Telegram codec does not decode ChatSdk subjects', () => {
    expect(telegram.decode(chatSdk.encode('999', 'group'))).toBeNull();
  });
});
