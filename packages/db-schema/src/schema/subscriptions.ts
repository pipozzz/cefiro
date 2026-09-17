import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { versionColumn } from "./shared";

/**
 * A user's paid subscription (one per user). Absence of a row — or a row that
 * is no longer active — means the user is on the free plan. The billing
 * provider (Stripe) is the source of truth; this table is the local projection
 * its webhook keeps in sync, so entitlement checks never call out to Stripe.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The paid plan this subscription grants: "plus" | "family".
    plan: text("plan").notNull(),
    // Provider status: "active" | "trialing" | "past_due" | "canceled" | …
    status: text("status").notNull(),
    provider: text("provider").notNull().default("stripe"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    // When the current paid period ends; a canceled sub keeps access until then.
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    unique("uq_subscriptions_user_id").on(t.userId),
    index("idx_subscriptions_stripe_customer_id").on(t.stripeCustomerId),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
