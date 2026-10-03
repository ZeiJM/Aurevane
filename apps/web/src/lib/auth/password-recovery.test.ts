import { describe, expect, it, vi } from 'vitest'
import {
  PASSWORD_RESET_REQUEST_MESSAGE,
  requestAccountPasswordReset,
  validateNewAccountPassword,
} from './password-recovery'

describe('password recovery', () => {
  it('uses the existing callback URI and gives the same response for existing or absent accounts', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    const client = { auth: { resetPasswordForEmail } }
    for (const email of ['existing@example.test', 'unknown@example.test']) {
      expect(await requestAccountPasswordReset(client, email, 'https://aurevane.test')).toEqual({
        message: PASSWORD_RESET_REQUEST_MESSAGE,
        tone: 'neutral',
      })
      expect(resetPasswordForEmail).toHaveBeenLastCalledWith(email, {
        redirectTo: 'https://aurevane.test/auth/callback?next=/game',
      })
    }
  })

  it('does not expose provider error contents', async () => {
    const client = {
      auth: {
        resetPasswordForEmail: vi
          .fn()
          .mockResolvedValue({ error: { message: 'private account detail' } }),
      },
    }
    const result = await requestAccountPasswordReset(
      client,
      'test@example.test',
      'https://aurevane.test',
    )
    expect(result.tone).toBe('error')
    expect(result.message).not.toContain('private account detail')
  })

  it('keeps the existing minimum password rule and requires confirmation', () => {
    expect(validateNewAccountPassword('1234567', '1234567')).toContain('8 characters')
    expect(validateNewAccountPassword('12345678', 'other')).toContain('do not match')
    expect(validateNewAccountPassword('12345678', '12345678')).toBeNull()
  })
})
