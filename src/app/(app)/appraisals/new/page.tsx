import { requireUser } from "@/lib/session";
import { NewAppraisalForm } from "./form";

export default async function NewAppraisalPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">New appraisal</h1>
      <NewAppraisalForm />
    </div>
  );
}
