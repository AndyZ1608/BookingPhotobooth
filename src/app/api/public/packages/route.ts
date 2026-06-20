import { ok, unknownError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { unitPrice: "asc" }],
    });

    return ok(packages);
  } catch (error) {
    return unknownError(error);
  }
}
