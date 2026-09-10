import { emit, on } from '@create-figma-plugin/utilities'
import { useEffect, useRef, useState } from 'preact/hooks'

import { CheckoutFinishedHandler, GetPaymentTokenHandler, PaymentTokenHandler } from '../types'
import { createPaymentSession, UsageState } from '../services/paymentSession'

let nextRequestId = 0

function getToken(signal: AbortSignal): Promise<Parameters<PaymentTokenHandler['handler']>[0]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Token request cancelled', 'AbortError'))
    const requestId = ++nextRequestId
    const unsubscribe = on<PaymentTokenHandler>('PAYMENT_TOKEN', identity => {
      if (identity.requestId !== requestId) return
      cleanup()
      resolve(identity)
    })
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Figma did not return a payments token. Reopen the plugin and try again.'))
    }, 15_000)
    function cleanup() {
      unsubscribe()
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    function abort() {
      cleanup()
      reject(new DOMException('Token request cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    emit<GetPaymentTokenHandler>('GET_PAYMENT_TOKEN', requestId)
  })
}

export function usePaymentSession(onCheckout: () => void) {
  const [usageState, setUsageState] = useState<UsageState>({ status: 'loading' })
  const [session] = useState(() => createPaymentSession({ getToken, onChange: setUsageState }))
  const checkoutRef = useRef(onCheckout)
  checkoutRef.current = onCheckout

  useEffect(() => {
    const unsubscribe = on<CheckoutFinishedHandler>('CHECKOUT_FINISHED', () => {
      checkoutRef.current()
      void session.refresh()
    })
    void session.refresh()
    return () => { unsubscribe(); session.dispose() }
  }, [session])

  return { session, usageState }
}
