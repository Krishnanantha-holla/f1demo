import React from 'react'
import { render } from '@testing-library/react'
import { vi, expect, test } from 'vitest'

import { useWebSocket } from '../hooks/useWebSocket'

function TestComp() {
  useWebSocket({ onMessage: () => {}, enabled: true })
  return null
}

test('does not schedule reconnect after unmount', () => {
  vi.useFakeTimers()
  const created = []
  const OriginalWebSocket = global.WebSocket

  global.WebSocket = class {
    constructor(url) {
      this.url = url
      created.push(this)
      // simulate onopen on next tick
      setTimeout(() => this.onopen && this.onopen(), 0)
    }
    close() {
      this.onclose && this.onclose()
    }
    send() {}
  }

  const { unmount } = render(React.createElement(TestComp))
  // process the onopen tick
  vi.runAllTimers()
  expect(created.length).toBe(1)

  // simulate close which would normally schedule a reconnect
  created[0].onclose && created[0].onclose()

  // unmount before reconnect fires
  unmount()

  // advance timers; if reconnect were scheduled, a new WebSocket would be created
  vi.runAllTimers()
  expect(created.length).toBe(1)

  // cleanup
  global.WebSocket = OriginalWebSocket
  vi.useRealTimers()
})
