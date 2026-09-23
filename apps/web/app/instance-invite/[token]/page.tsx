import type { Metadata } from "next";

import { InstanceInviteClient } from "./instance-invite-client";

export const metadata: Metadata = {
  title: "Invitation | Cefiro",
  // A private, tokenized link — never index it.
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function InstanceInvitePage({ params }: Props) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <InstanceInviteClient token={token} />
    </main>
  );
}
