"use client";

import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeReturnPath } from "@/lib/login-redirect";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || json.ok === false) {
        setError(json.error || "ログインに失敗しました。");
        return;
      }

      window.location.assign(safeReturnPath(nextPath));
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">メールアドレス</span>
        <Input
          data-testid="login-email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          inputMode="email"
          autoComplete="username"
          maxLength={254}
          autoFocus
          required
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">パスワード</span>
        <Input
          data-testid="login-password"
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          maxLength={256}
          required
        />
      </label>
      {error ? (
        <div
          data-testid="login-error"
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !email.trim() || !password}
        data-testid="login-submit"
      >
        {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
        ログイン
      </Button>
    </form>
  );
}
