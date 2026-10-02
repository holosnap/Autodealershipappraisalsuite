import { requireUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <span className="font-semibold">Appraisals</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">
            {user.name} · {user.role}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
