import { emit, on } from '@create-figma-plugin/utilities'

import { ExportImageHandler, ImageExportedHandler } from '../types'
import { createHostRequests } from './hostRequests'

export function createComponentImageExporter() {
  const requests = createHostRequests<string, Parameters<ImageExportedHandler['handler']>[0]>({
    subscribe: receive => on<ImageExportedHandler>('IMAGE_EXPORTED', receive),
    send: (id, requestId) => emit<ExportImageHandler>('EXPORT_IMAGE', { id, requestId }),
    timeoutMs: 30_000,
    timeoutMessage: 'Figma did not return a component image. Try generating again.',
  })
  return {
    async export(id: string, signal: AbortSignal): Promise<string | null> {
      const response = await requests.request(id, signal)
      if (response.id !== id) throw new Error('Figma returned an image for a different component. Try again.')
      return response.imageBase64
    },
    dispose: requests.dispose,
  }
}
