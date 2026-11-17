import { LoginForm } from "@/components/aio/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeReturnPath } from "@/lib/login-redirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10 text-slate-950">
      <Card className="w-full max-w-[440px] shadow-sm">
        <CardHeader>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            AIO Article Studio
          </div>
          <CardTitle className="text-2xl">ログイン</CardTitle>
          <CardDescription>
            登録済みのメールアドレスとパスワードを入力してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm nextPath={safeReturnPath(next)} />
        </CardContent>
      </Card>
    </main>
  );
}
