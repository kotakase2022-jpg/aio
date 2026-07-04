import { DemoLoginForm } from "@/components/aio/demo-login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DemoLoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function DemoLoginPage({ searchParams }: DemoLoginPageProps) {
  const { next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10 text-slate-950">
      <Card className="w-full max-w-[440px] shadow-sm">
        <CardHeader>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            AIO Article Studio
          </div>
          <CardTitle className="text-2xl">デモアクセス</CardTitle>
          <CardDescription>
            社外デモ用のアクセスコードを入力してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DemoLoginForm nextPath={nextPath} />
        </CardContent>
      </Card>
    </main>
  );
}

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
