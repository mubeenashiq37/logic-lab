"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AuthCard,
  CodeInput,
  FormAlert,
  GoogleButton,
  reasonMessage,
} from "@/components/auth/auth-ui";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { afterLoginPath, ME_KEY, useMe } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { SessionResponse } from "@/types/api";

const schema = z.object({
  pin: z.string().regex(/^\d{6}$/),
});
type Values = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [error, setError] = useState<string | null>(
    reasonMessage(params.get("reason") ?? params.get("error")),
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { pin: "" },
  });

  useEffect(() => {
    if (me) {
      router.replace(afterLoginPath(me.user.role, me.mfa, params.get("next")));
    }
  }, [me, router, params]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const session = await api<SessionResponse>("/auth/login", {
        method: "POST",
        body: { pin: values.pin },
      });
      queryClient.setQueryData(ME_KEY, session);
      router.replace(afterLoginPath(session.user.role, session.mfa, params.get("next")));
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthCard
      title={t.auth.login.title}
      subtitle={t.auth.login.subtitle}
      footer={
        <>
          {t.auth.login.noAccount}{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            {t.auth.login.createAccount}
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormAlert message={error} />
        <Field label="6-digit PIN" htmlFor="pin" error={form.formState.errors.pin?.message}>
          <CodeInput
            value={form.watch("pin")}
            onChange={(value) => form.setValue("pin", value, { shouldValidate: true })}
            onComplete={(value) => form.setValue("pin", value, { shouldValidate: true })}
            disabled={form.formState.isSubmitting}
          />
        </Field>
        <div className="text-muted-foreground text-xs">
          Only approved users can sign in with their 6-digit PIN.
        </div>
        <Button type="submit" className="h-9" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t.auth.login.submit}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
