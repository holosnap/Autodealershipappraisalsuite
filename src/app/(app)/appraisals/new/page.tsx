import { requireUser } from "@/lib/session";
import { NewAppraisalForm } from "./form";

export default async function NewAppraisalPage() {
  await requireUser();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">New appraisal</h1>
      <NewAppraisalForm />
    </div>
  );
}
