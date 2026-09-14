import { BaseProviders } from "../../providers/base-providers";

export default function PublicRecipeLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders>
      <div className="min-h-dvh">{children}</div>
    </BaseProviders>
  );
}
