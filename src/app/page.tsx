import { cookies } from "next/headers";
import { ArticleGeneratorApp } from "@/components/aio/article-generator-app";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/server/auth-session";

export default async function Home() {
  // The proxy already admitted this request; this only reads which account is signed in.
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  return <ArticleGeneratorApp userEmail={session?.email ?? null} />;
}
