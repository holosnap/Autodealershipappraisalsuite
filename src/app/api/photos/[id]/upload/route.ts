import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appraisalPhotos } from "@/db/schema";
import { canEditDraft } from "@/lib/rbac";
import { getSessionUser } from "@/lib/session";
import { storageMode, writeLocal } from "@/lib/storage";
import { MAX_PHOTO_BYTES } from "@/features/appraisals/photo-slots";

// Local-dev upload target. In S3/R2 mode the browser PUTs straight to the bucket instead.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (storageMode !== "local") return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const photo = await db.query.appraisalPhotos.findFirst({
    where: eq(appraisalPhotos.id, id),
    with: { appraisal: { columns: { createdBy: true, status: true } } },
  });
  if (!photo || photo.status !== "pending" || !canEditDraft(user, photo.appraisal)) {
    return new Response("Not found", { status: 404 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0 || body.length > MAX_PHOTO_BYTES) return new Response("Bad size", { status: 413 });
  if (req.headers.get("content-type") !== photo.contentType) return new Response("Bad type", { status: 415 });
  await writeLocal(photo.storageKey, body);
  return new Response(null, { status: 200 });
}
