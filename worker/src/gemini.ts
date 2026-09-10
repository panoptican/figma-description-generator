import { GEMINI_MODEL, MAX_OUTPUT_TOKENS } from './constants'

export class UpstreamError extends Error {
  constructor(message = 'The generation service could not complete the request. Try again shortly.', public readonly status = 502, public readonly retryAfter?: number) {
    super(message)
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UpstreamError()
  return value as Record<string, unknown>
}

export async function generateText(request: { prompt: string; imageBase64?: string }, apiKey: string) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  if (request.imageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: request.imageBase64 } })
  parts.push({ text: request.prompt })

  let upstream: Response
  let body: unknown
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS } }),
    })
    if (upstream.status === 429) throw new UpstreamError('The generation service is busy. Try again in a moment.', 503, 10)
    if (!upstream.ok) throw new UpstreamError()
    body = await upstream.json()
  } catch (error) {
    throw error instanceof UpstreamError ? error : new UpstreamError()
  }

  const data = object(body)
  const feedback = data.promptFeedback === undefined ? {} : object(data.promptFeedback)
  if (data.candidates !== undefined && !Array.isArray(data.candidates)) throw new UpstreamError()
  const candidates = data.candidates as unknown[] | undefined
  const candidate = candidates?.length ? object(candidates[0]) : {}
  if (feedback.blockReason || candidate.finishReason === 'SAFETY') {
    throw new UpstreamError('The model declined this request. Adjust the prompt or component content and try again.', 422)
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new UpstreamError('The model reached its response limit. Try a smaller component or variant set.')
  }
  const content = candidate.content === undefined ? {} : object(candidate.content)
  const responseParts = content.parts === undefined ? [] : content.parts
  if (!Array.isArray(responseParts)) throw new UpstreamError()
  const description = responseParts.map(value => {
    const part = object(value)
    if (part.text !== undefined && typeof part.text !== 'string') throw new UpstreamError()
    return part.text || ''
  }).join('').trim()
  if (!description) throw new UpstreamError('No description was returned. Try again.')

  const metadata = data.usageMetadata === undefined ? {} : object(data.usageMetadata)
  const count = (key: string) => typeof metadata[key] === 'number' ? metadata[key] : undefined
  return {
    description,
    tokenCounts: { promptTokens: count('promptTokenCount'), outputTokens: count('candidatesTokenCount'), totalTokens: count('totalTokenCount') },
  }
}
