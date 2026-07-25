import { describe, expect, it } from 'vitest'
import { DEFAULT_OPEN_IN_APPLICATIONS, normalizeOpenInApplications } from './open-in-applications'

describe('normalizeOpenInApplications', () => {
  it('trims fields, drops invalid rows, keeps first duplicate id, and caps list', () => {
    const rows = normalizeOpenInApplications([
      { id: 'a', label: ' Cursor ', command: ' cursor ' },
      { id: 'a', label: 'Dup', command: 'dup' },
      { id: 'b', label: '   ', command: 'zed' },
      { id: 'c', label: 'Zed', command: '   ' },
      { id: 'd', label: 'D', command: 'd' },
      { id: 'e', label: 'E', command: 'e' },
      { id: 'f', label: 'F', command: 'f' },
      { id: 'g', label: 'G', command: 'g' },
      { id: 'h', label: 'H', command: 'h' },
      { id: 'i', label: 'I', command: 'i' },
      { id: 'j', label: 'J', command: 'j' }
    ])

    expect(rows).toEqual([
      { id: 'a', label: 'Cursor', command: 'cursor' },
      { id: 'd', label: 'D', command: 'd' },
      { id: 'e', label: 'E', command: 'e' },
      { id: 'f', label: 'F', command: 'f' },
      { id: 'g', label: 'G', command: 'g' },
      { id: 'h', label: 'H', command: 'h' },
      { id: 'i', label: 'I', command: 'i' },
      { id: 'j', label: 'J', command: 'j' }
    ])
  })

  it('generates ids for missing or blank ids', () => {
    let counter = 0
    const rows = normalizeOpenInApplications(
      [
        { label: 'Cursor', command: 'cursor' },
        { id: '   ', label: 'Zed', command: 'zed' }
      ],
      { createId: () => `gen-${++counter}` }
    )

    expect(rows).toEqual([
      { id: 'gen-1', label: 'Cursor', command: 'cursor' },
      { id: 'gen-2', label: 'Zed', command: 'zed' }
    ])
  })

  // Why these four: this normalizer guards the store on load AND on every settings write, so a
  // rule here that requires `command` deletes browser-editor entries on the next launch rather
  // than rejecting them visibly.
  it('keeps a URL entry that has no command', () => {
    expect(
      normalizeOpenInApplications([
        { id: 'code-server', label: 'code-server', url: 'https://cs.example.com/?folder={path}' }
      ])
    ).toEqual([
      {
        id: 'code-server',
        label: 'code-server',
        command: '',
        url: 'https://cs.example.com/?folder={path}'
      }
    ])
  })

  it('preserves url on an entry that has both', () => {
    expect(
      normalizeOpenInApplications([
        { id: 'x', label: 'X', command: 'code', url: 'https://e.com/?folder={path}' }
      ])
    ).toEqual([{ id: 'x', label: 'X', command: 'code', url: 'https://e.com/?folder={path}' }])
  })

  it('omits the url key entirely on a plain command entry', () => {
    const [row] = normalizeOpenInApplications([{ id: 'x', label: 'X', command: 'code' }])
    expect(Object.hasOwn(row, 'url')).toBe(false)
  })

  it('still drops an entry with neither command nor url', () => {
    expect(normalizeOpenInApplications([{ id: 'x', label: 'X' }])).toEqual([])
    expect(normalizeOpenInApplications([{ id: 'x', label: 'X', command: '  ', url: ' ' }])).toEqual(
      []
    )
  })

  it('seeds defaults only when the persisted field is missing', () => {
    expect(normalizeOpenInApplications(undefined, { seedDefaults: true })).toEqual(
      DEFAULT_OPEN_IN_APPLICATIONS
    )
    expect(normalizeOpenInApplications([], { seedDefaults: true })).toEqual([])
  })
})
