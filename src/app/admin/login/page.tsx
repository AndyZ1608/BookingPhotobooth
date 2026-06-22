import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getSafeNextPath } from "@/lib/navigation";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <AdminLoginForm nextPath={nextPath} />
    </main>
  );
}
