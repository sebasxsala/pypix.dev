import type { H3Event } from 'h3'

export function getRequestAbortSignal(event: H3Event) {
  const controller = new AbortController()

  event.node.req.once('close', () => {
    if (!event.node.res.writableEnded) {
      controller.abort(new DOMException('Request closed', 'AbortError'))
    }
  })

  return controller.signal
}
