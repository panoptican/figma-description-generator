// Figma replies cannot be cancelled. Keep one listener for the UI lifetime so
// late replies are safely ignored after their request is cancelled or times out.
export function createHostRequests<Input, Response extends { requestId: number }>(options: {
  subscribe: (receive: (response: Response) => void) => () => void
  send: (input: Input, requestId: number) => void
  timeoutMs: number
  timeoutMessage: string
}) {
  let nextRequestId = 0
  let disposed = false
  const pending = new Map<number, { resolve: (response: Response) => void; abort: () => void }>()
  const unsubscribe = options.subscribe(response => pending.get(response.requestId)?.resolve(response))

  return {
    request(input: Input, signal: AbortSignal): Promise<Response> {
      return new Promise((resolve, reject) => {
        if (disposed || signal.aborted) return reject(new DOMException('Request cancelled', 'AbortError'))
        const requestId = ++nextRequestId
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error(options.timeoutMessage))
        }, options.timeoutMs)
        function cleanup() {
          pending.delete(requestId)
          clearTimeout(timeout)
          signal.removeEventListener('abort', abort)
        }
        function abort() {
          cleanup()
          reject(new DOMException('Request cancelled', 'AbortError'))
        }
        pending.set(requestId, { resolve: response => { cleanup(); resolve(response) }, abort })
        signal.addEventListener('abort', abort, { once: true })
        try { options.send(input, requestId) } catch (error) { cleanup(); reject(error) }
      })
    },
    dispose() {
      disposed = true
      pending.forEach(request => request.abort())
      unsubscribe()
    },
  }
}
