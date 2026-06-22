import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAdminSession } from "@/server/auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login?next=%2Fadmin");
  }

  return children;
}
