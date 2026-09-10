# Third-party payments investigation

## Status: INVESTIGATING

PR #2 is merged at `dcc3af8ed102ce02bf5115d710895922087525a9`. Continue this work on `codex/third-party-payments`. The publisher-managed generation service, usage limits, and UI are the working baseline; merging them does not publish the plugin or establish a working paid checkout.

Jason requested a separate branch to investigate and implement third-party payments because native seller onboarding appears unavailable to his account. No replacement provider has been selected, and no payment migration has been implemented.

## What the sources establish

- In the [forum thread Jason supplied](https://forum.figma.com/ask-the-community-7/is-it-currently-impossible-to-sell-a-figma-plugin-yes-or-no-42302), Figma staff confirmed on July 14, 2025 that third-party payment pages may be linked from a plugin's UI and Community description.
- A later staff reply on September 10, 2025 explicitly said new plugin and widget sellers were being approved for native payments; the closure applied to files. The thread therefore does not establish that native payments are closed to all new plugin sellers.
- A [May 27, 2026 staff clarification](https://forum.figma.com/ask-the-community-7/can-plugins-still-use-figma-native-payments-monetization-54336) says plugin/widget sellers in supported countries can set up Stripe without separate approval. A July 13 follow-up directs account-specific disabled-pricing/onboarding issues to `content-reviews@figma.com`.
- These sources were checked September 10, 2026. Jason's actual native-payment eligibility remains unconfirmed. Resolve that question before treating an external provider as required. No message to Figma has been sent for this investigation.

## Preserve the existing product decisions

- Publisher-owned AI credentials stay on the Worker; no bring-your-own-key flow.
- Keep 1,000 lifetime free descriptions and 10,000 Pro descriptions per UTC calendar month. Preserve existing usage when changing authentication or billing.
- Keep the current intended prices of $10/month and $96/year unless Jason changes them. Provider selection must account for those prices.
- The seven-day subscription trial in spec 059 depends on Figma. If checkout moves elsewhere, define when the trial starts, its quota, and how it relates to the lifetime free allowance explicitly.

## Investigation and implementation sequence

1. Confirm whether native seller onboarding is blocked for this individual account. Preserve the external-payment option even if native access is restored.
2. Compare a small number of hosted-checkout options for seller eligibility, fees, tax handling, subscriptions/trials, cancellation, refunds, and customer self-service. Select the provider before changing production dependencies or the database schema.
3. Establish server-verifiable identity for a publicly listed free plugin. Current usage and generation both require a Figma payment token (`src/main.ts`, `src/services/paymentSession.ts`, `worker/src/identity.ts`, and `worker/src/index.ts`). Do not assume these tokens remain available outside native paid publishing, or trust a client-supplied user ID. Prove the identity flow in the intended listing configuration and preserve the existing account's quota history.
4. Open hosted checkout externally, link the purchase to the verified account, and derive entitlement server-side. Replace the native `initiateCheckoutAsync` flow. Returning from a checkout page alone must not grant Pro.
5. Handle verified webhook events, duplicate and out-of-order delivery, failed renewal, cancellation, refunds, and restoring purchases. Keep usage reservations and rollback independent of the payment provider.
6. Update the upgrade controls, account/customer portal flow, privacy disclosure, listing copy, and resubmission notes to match the implemented service.

## Acceptance evidence

- Usage and free generation work for a real user in the intended publicly listed free-plugin configuration.
- A test checkout grants Pro only to the verified account; cancellation or an applicable refund removes entitlement at the intended time.
- Webhook signature checks, replay/order handling, account isolation, quota preservation, and failed-generation rollback have meaningful automated coverage.
- Plugin build, Worker typecheck, and the relevant existing tests pass. Record provider test-mode checks separately from production payment and live Figma checks.

Current branch contains investigation notes only. Production still uses the Figma payment identity and checkout path from PR #2.
