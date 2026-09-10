import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

// Keep this origin stable: browser-saved QA results belong to this exact URL.
const port = 4318
const root = new URL('../release/', import.meta.url)
const routes = new Map([
  ['/', ['checklist/index.html', 'text/html']],
  ['/app.js', ['checklist/app.js', 'text/javascript']],
  ['/styles.css', ['checklist/styles.css', 'text/css']],
  ['/qa-checklist.md', ['qa-checklist.md', 'text/plain']],
])

const server = createServer(async (request, response) => {
  const route = routes.get(new URL(request.url, `http://127.0.0.1:${port}`).pathname)
  if (request.method !== 'GET' || !route) {
    response.writeHead(404).end('Not found')
    return
  }
  try {
    const body = await readFile(new URL(route[0], root))
    response.writeHead(200, {
      'Content-Type': `${route[1]}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src data: blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    }).end(body)
  } catch {
    response.writeHead(500).end('Could not load the checklist. Check the release files.')
  }
})

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Reuse the existing checklist server or stop the conflicting process. The port is fixed to preserve saved results.`
    : error.message)
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => {
  console.log(`Description Generator QA: http://127.0.0.1:${port}/ — PID ${process.pid}`)
  console.log('Results and screenshots stay in this browser. Export a backup before clearing browser data.')
})
