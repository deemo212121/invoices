"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { changePassword, login, setupPassword } from "@/app/actions/auth";
import { Field, FormMessage } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-500">Enter the store password.</p>
      </div>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Password">
        <input name="password" type="password" required autoFocus autoComplete="current-password" className="input h-11" />
      </Field>
      <button className="btn h-11 w-full" disabled={pending}>
        <Lock className="size-4" /> {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupPassword, {});
  return (
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="font-semibold tracking-tight">Turn on sign-in</h2>
        <p className="text-sm text-zinc-500">
          Right now this computer and your shop Wi-Fi open the app without a password, and the online address is
          off. Create a store password to require sign-in everywhere and allow online access.
        </p>
      </div>
      <FormMessage state={state} />
      <Field label="Password (at least 8 characters)">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </Field>
      <Field label="Type it again">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </Field>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : "Create password"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="font-semibold tracking-tight">Store password</h2>
        <p className="text-sm text-zinc-500">Changing it signs out every other phone and computer.</p>
      </div>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password">
          <input name="current" type="password" required autoComplete="current-password" className="input" />
        </Field>
        <Field label="New password">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </Field>
        <Field label="New password again">
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </Field>
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
