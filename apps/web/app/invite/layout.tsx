import { BaseProviders } from "../providers/base-providers";

/**
 * The household-invite accept flow is a standalone page (no app shell), but its
 * client uses tRPC (getInvite / acceptInvite) and toasts. The root layout only
 * provides i18n and theming, so wrap this route in BaseProviders — otherwise
 * `useTRPC()` has no provider and the page throws into the error boundary.
 */
export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <BaseProviders>{children}</BaseProviders>;
}
