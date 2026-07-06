"use client";

import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DemoLoginFormProps = {
  nextPath: string;
};

export function DemoLoginForm({ nextPath }: DemoLoginFormProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/demo-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || json.ok === false) {
        setError(json.error || "認証に失敗しました。");
        return;
      }

      window.location.assign(normalizeNextPath(nextPath));
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">アクセスコード</span>
        <Input
          data-testid="demo-access-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="6桁のコード"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
        />
      </label>
      {error ? (
        <div
          data-testid="demo-login-error"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !code.trim()}
        data-testid="demo-login-submit"
      >
        {loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
        デモを開く
      </Button>
    </form>
  );
}

function normalizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
