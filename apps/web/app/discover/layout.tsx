import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

import { BaseProviders } from "../providers/base-providers";

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders>
      <div className="min-h-dvh">
        <header className="flex items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" aria-label="Home" className="flex items-center">
            <BrandLogo priority height={28} width={112} />
          </Link>
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            Open app
          </Link>
        </header>
        {children}
      </div>
    </BaseProviders>
  );
}
