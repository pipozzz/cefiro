import { NextResponse } from "next/server";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getStripe, isStripeConfigured } from "@norish/shared-server/billing/stripe";
import { handleStripeEvent } from "@norish/shared-server/billing/webhook";
import { serverLogger as log } from "@norish/shared-server/logger";

// Needs Node (Stripe signature verification, DB access) and the raw body.
export const runtime = "nodejs";

/**
 * Stripe subscription webhook. Verifies the signature, then applies the event
 * to the local subscription projection. Reachable unauthenticated (Stripe
 * calls it) — the auth proxy excludes `api/stripe`.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured() || !SERVER_CONFIG.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // The raw body is required for signature verification.
  const body = await request.text();

  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      SERVER_CONFIG.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    log.warn({ err }, "Rejected Stripe webhook with an invalid signature");

    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // Return 500 so Stripe retries a transient failure.
    log.error({ err, type: event.type }, "Failed to handle Stripe webhook event");

    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
