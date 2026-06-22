import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdminSession } from "@/server/auth";

export default async function AdminPage() {
  const admin = await requireAdminSession();

  return <AdminDashboard adminName={admin.username} />;
}
