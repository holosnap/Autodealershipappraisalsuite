import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appraisalPhotos } from "@/db/schema";
import { canViewAppraisal } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { getDownloadUrl, readLocal } from "@/lib/storage";

// Authenticated photo access: checks the viewer may see the appraisal, then redirects to a
// short-lived signed URL (S3/R2) or streams the file (local dev storage).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const photo = await db.query.appraisalPhotos.findFirst({
    where: eq(appraisalPhotos.id, id),
    with: { appraisal: { columns: { createdBy: true, status: true } } },
  });
  if (!photo || photo.status !== "uploaded" || !canViewAppraisal(user, photo.appraisal)) {
    return new Response("Not found", { status: 404 });
  }

  const signed = await getDownloadUrl(photo.storageKey);
  if (signed) return Response.redirect(signed, 307);
  try {
    const data = await readLocal(photo.storageKey);
    return new Response(new Uint8Array(data), {
      headers: { "content-type": photo.contentType, "cache-control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
