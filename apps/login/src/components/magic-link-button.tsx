"use client";

import { sendMagicLink } from "@/lib/actions/magic-link";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "./alert";
import { Button, ButtonVariants } from "./button";
import { Spinner } from "./spinner";
import { Translated } from "./translated";

type Props = { loginName: string; organization?: string; requestId?: string };

export function MagicLinkButton({ loginName, organization, requestId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setError("");
    setLoading(true);
    try {
      const response = await sendMagicLink({ loginName, organization, requestId });
      handleServerActionResponse(response, router, () => undefined, setError);
    } catch {
      setError("magicLink.unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 flex w-full flex-col items-center space-y-3">
      <p className="text-text-light-secondary-500 dark:text-text-dark-secondary-500 text-sm">
        <Translated i18nKey="magicLink.or" namespace="password" />
      </p>
      <Button
        type="button"
        variant={ButtonVariants.Secondary}
        className="w-full justify-center"
        disabled={loading}
        onClick={send}
        data-testid="magic-link-button"
      >
        {loading && <Spinner className="mr-2 h-5 w-5" />}
        <Translated i18nKey="magicLink.button" namespace="password" />
      </Button>
      {error && (
        <div className="w-full" data-testid="magic-link-error">
          <Alert>{error === "magicLink.unavailable" ? <Translated i18nKey="magicLink.unavailable" namespace="password" /> : error}</Alert>
        </div>
      )}
    </div>
  );
}
