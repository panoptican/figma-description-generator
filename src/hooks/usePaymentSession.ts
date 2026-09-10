import { emit, on } from '@create-figma-plugin/utilities'
import { useEffect, useRef, useState } from 'preact/hooks'

import { CheckoutFinishedHandler, GetPaymentTokenHandler, PaymentTokenHandler } from '../types'
import { createPaymentSession, UsageState } from '../services/paymentSession'
import { createHostRequests } from '../services/hostRequests'

export function usePaymentSession(onCheckout: () => void) {
  const [usageState, setUsageState] = useState<UsageState>({ status: 'loading' })
  const [tokens] = useState(() => createHostRequests<void, Parameters<PaymentTokenHandler['handler']>[0]>({
    subscribe: receive => on<PaymentTokenHandler>('PAYMENT_TOKEN', receive),
    send: (_input, requestId) => emit<GetPaymentTokenHandler>('GET_PAYMENT_TOKEN', requestId),
    timeoutMs: 15_000,
    timeoutMessage: 'Figma did not return a payments token. Reopen the plugin and try again.',
  }))
  const [session] = useState(() => createPaymentSession({
    getToken: signal => tokens.request(undefined, signal), onChange: setUsageState,
  }))
  const checkoutRef = useRef(onCheckout)
  checkoutRef.current = onCheckout

  useEffect(() => {
    const unsubscribe = on<CheckoutFinishedHandler>('CHECKOUT_FINISHED', () => {
      checkoutRef.current()
      void session.refresh()
    })
    void session.refresh()
    return () => { unsubscribe(); session.dispose(); tokens.dispose() }
  }, [session, tokens])

  return { session, usageState }
}
