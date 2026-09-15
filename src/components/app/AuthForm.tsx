"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Field, GoogleG, Icon, Input } from "@/components/ui";
import { continueWithGoogle, createWithEmail, sendReset, signInWithEmail, type AuthResult } from "@/lib/auth/actions";
import { INVALID_EMAIL_MESSAGE, isPlausibleEmail, normalizeEmail } from "@/lib/auth/email";
import { authErrorCode, authErrorMessage } from "@/lib/auth/errors";
import type { AuthMode } from "@/lib/auth/intent";

export type { AuthMode };

interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: (result: AuthResult) => void | Promise<void>;
}

export function AuthForm({ mode, onModeChange, onSuccess }: AuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (kind: "google" | "email" | "reset", task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      const code = authErrorCode(e);
      if (code === "auth/email-already-in-use") onModeChange("signin");
      setError(authErrorMessage(e));
      if (process.env.NODE_ENV !== "production") console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return setError("Enter your email address.");
    if (!isPlausibleEmail(email)) return setError(INVALID_EMAIL_MESSAGE);
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    void run("email", async () => {
      const result =
        mode === "create"
          ? await createWithEmail({ name, email, password })
          : await signInWithEmail({ email, password });
      await onSuccess(result);
    });
  };

  const forgot = () => {
    if (!email.trim()) return setError("Enter your email address first, then tap “Forgot password?”.");
    if (!isPlausibleEmail(email)) return setError(INVALID_EMAIL_MESSAGE);
    void run("reset", async () => {
      await sendReset(email);
      setNotice(`We emailed a password reset link to ${normalizeEmail(email)}.`);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Button
        type="button"
        variant="outline"
        size="lg"
        block
        loading={busy === "google"}
        disabled={busy !== null}
        onClick={() => run("google", async () => onSuccess(await continueWithGoogle()))}
      >
        {busy === "google" ? null : <GoogleG />}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-[12px] text-placeholder">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {mode === "create" ? (
          <Field label="Your name" htmlFor="auth-name">
            <Input
              id="auth-name"
              name="name"
              autoComplete="given-name"
              placeholder="e.g. Ros"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="auth-email">
          <Input
            id="auth-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(error) && !isPlausibleEmail(email)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="auth-password"
          helper={mode === "create" ? "At least 8 characters." : undefined}
        >
          <div className="relative">
            <Input
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              placeholder={mode === "create" ? "Create a password" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-ground"
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
            </button>
          </div>
        </Field>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {notice ? (
          <p role="status" className="text-[13px] font-semibold text-success">
            {notice}
          </p>
        ) : null}

        <Button type="submit" size="lg" block loading={busy === "email"} disabled={busy !== null}>
          {mode === "create" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2 text-[13px] text-muted">
        {mode === "signin" ? (
          <button type="button" onClick={forgot} disabled={busy !== null} className="font-semibold text-navy">
            Forgot password?
          </button>
        ) : null}
        {mode === "create" ? (
          <p>
            Already have an account?{" "}
            <button type="button" onClick={() => onModeChange("signin")} className="font-semibold text-navy">
              Sign in
            </button>
          </p>
        ) : (
          <p>
            New to Webbi?{" "}
            <button type="button" onClick={() => onModeChange("create")} className="font-semibold text-navy">
              Create an account
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export function LegalNote() {
  return (
    <p className="text-center text-[12px] leading-[1.5] text-muted">
      By continuing you agree to Webbi&apos;s{" "}
      <Link href="/terms" className="font-semibold text-navy">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="font-semibold text-navy">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
