import { describe, expect, it } from 'vitest'
import { getAppTitle } from './appText.js'

describe('getAppTitle', () => {
  it('returns the product name', () => {
    expect(getAppTitle()).toBe('LuminAI')
  })
})
