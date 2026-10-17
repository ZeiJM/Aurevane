import { AurevaneError } from '@aurevane/game-core/errors'
import { describe, expect, it } from 'vitest'

import { parseChatChannel, resolveChatChannel } from './chat-channel'

const ME = '11111111-1111-4111-8111-111111111111'
const THEM = '00000000-0000-4000-8000-000000000002'

describe('chat channel resolution', () => {
  it('accepts only the supported channel shapes', () => {
    expect(parseChatChannel('world')).toEqual({ kind: 'world' })
    expect(parseChatChannel('feed')).toEqual({ kind: 'feed' })
    expect(parseChatChannel('village')).toEqual({ kind: 'village' })
    expect(parseChatChannel(`whisper:${THEM}`)).toEqual({ kind: 'whisper', characterId: THEM })
    expect(parseChatChannel(`group:${THEM}`)).toEqual({ kind: 'group', groupId: THEM })
    expect(parseChatChannel(`lobby:${THEM}`)).toEqual({ kind: 'lobby', lobbyId: THEM })
    for (const bad of [
      null,
      42,
      '',
      'team',
      'dm:a:b',
      'village:duskhaven',
      'whisper:nope',
      'whisper:AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      `whisper:${THEM}:extra`,
      'world:1',
      `feed:${ME}`,
      'x'.repeat(200),
    ]) {
      expect(() => parseChatChannel(bad)).toThrow(AurevaneError)
    }
  })

  it('orders whisper keys the same way the database does', () => {
    const resolved = resolveChatChannel(ME, { kind: 'whisper', characterId: THEM }, null)
    expect(resolved).toEqual({ key: `dm:${THEM}:${ME}`, kind: 'whisper' })
    expect(resolveChatChannel(THEM, { kind: 'whisper', characterId: ME }, null).key).toBe(
      resolved.key,
    )
  })

  it('refuses whispering yourself', () => {
    expect(() => resolveChatChannel(ME, { kind: 'whisper', characterId: ME }, null)).toThrow(
      /yourself/,
    )
  })

  it('opens Village only while standing in a village', () => {
    expect(() => resolveChatChannel(ME, { kind: 'village' }, null)).toThrow(/stand in a village/)
    expect(resolveChatChannel(ME, { kind: 'village' }, 'village:duskhaven')).toEqual({
      key: 'village:duskhaven',
      kind: 'village',
    })
  })

  it('resolves feed only from the selected character', () => {
    expect(resolveChatChannel(ME, { kind: 'feed' }, null)).toEqual({
      key: `feed:${ME}`,
      kind: 'feed',
    })
  })

  it('never lets the client choose a village key', () => {
    expect(() => parseChatChannel('village:duskhaven')).toThrow(AurevaneError)
  })
})
