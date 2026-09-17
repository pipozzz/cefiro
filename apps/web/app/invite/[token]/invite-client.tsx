"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Button, InputGroup, Label, Link, TextField } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { signUp, useSession } from "@norish/shared/lib/auth/client";

const INVITE_HEADER = "x-household-invite";

export function InviteClient({ token }: { token: string }) {
  const t = useTranslations("auth.invite");
  const tSignup = useTranslations("auth.signup");
  const router = useRouter();
  const trpc = useTRPC();

  const { data: session, isPending: sessionLoading } = useSession();
  const inviteQuery = useQuery({
    ...trpc.households.getInvite.queryOptions({ token }),
    retry: false,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useMutation(
    trpc.households.acceptInvite.mutationOptions({
      onSuccess: () => router.push("/settings?tab=household"),
      onError: (err) => {
        setError(err.message || t("errors.generic"));
        setBusy(false);
      },
    })
  );

  if (sessionLoading || inviteQuery.isLoading) {
    return <p className="text-default-500 text-center text-sm">{t("loading")}</p>;
  }

  const household = inviteQuery.data?.invite?.householdName;

  // Invalid, expired, or already-accepted invite.
  if (!household) {
    return (
      <div className="border-default-200 flex flex-col items-center gap-3 rounded-2xl border p-6 text-center">
        <h1 className="text-xl font-semibold">{t("invalid.title")}</h1>
        <p className="text-default-500 text-sm">{t("invalid.body")}</p>
        <Link href="/login" className="text-sm">
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  const heading = t("title", { household });

  // Already signed in: accept directly.
  if (session?.user) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="text-default-500 text-sm">{t("leadLoggedIn")}</p>
        </div>
        {error ? <p className="text-danger text-sm">{error}</p> : null}
        <Button
          variant="primary"
          isPending={accept.isPending}
          onPress={() => {
            setError(null);
            accept.mutate({ token });
          }}
        >
          {t("acceptCta")}
        </Button>
      </div>
    );
  }

  // Not signed in: create an account (the invite permits it even when public
  // registration is locked), then accept.
  const isValid = name.trim() && email.trim() && password.length >= 8;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await signUp.email(
        { name, email, password },
        { headers: { [INVITE_HEADER]: token } }
      );

      if (result.error) {
        // The email-match / locked-registration rejection lands here.
        setError(result.error.message || t("errors.signupFailed"));
        setBusy(false);

        return;
      }

      // Session is now set; join the household with the same token.
      accept.mutate({ token });
    } catch {
      setError(t("errors.generic"));
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSignup}>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="text-default-500 text-sm">{t("leadSignup")}</p>
      </div>

      <TextField fullWidth isRequired name="name" type="text" value={name} onChange={setName}>
        <Label>{tSignup("name")}</Label>
        <InputGroup fullWidth>
          <InputGroup.Input autoComplete="name" placeholder={tSignup("namePlaceholder")} />
        </InputGroup>
      </TextField>

      <TextField fullWidth isRequired name="email" type="email" value={email} onChange={setEmail}>
        <Label>{tSignup("email")}</Label>
        <InputGroup fullWidth>
          <InputGroup.Input autoComplete="email" placeholder={tSignup("emailPlaceholder")} />
        </InputGroup>
        <p className="text-default-400 mt-1 text-xs">{t("emailNote")}</p>
      </TextField>

      <TextField
        fullWidth
        isRequired
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
      >
        <Label>{tSignup("password")}</Label>
        <InputGroup fullWidth>
          <InputGroup.Input
            autoComplete="new-password"
            placeholder={tSignup("passwordPlaceholder")}
          />
        </InputGroup>
      </TextField>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <Button variant="primary" type="submit" isDisabled={!isValid} isPending={busy}>
        {t("createAndJoin")}
      </Button>

      <p className="text-default-500 text-center text-sm">
        {t("haveAccount")}{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          className="text-sm"
        >
          {tSignup("signIn")}
        </Link>
      </p>
    </form>
  );
}
