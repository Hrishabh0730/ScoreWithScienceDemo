import { requireAdmin } from "@/lib/auth";
import { CrudList } from "../CrudList";
import { AdminHeader, Flash, type SP } from "../ui";

export default async function Faqs({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("faqs").select("*").order("sort_order");
  return (
    <>
      <AdminHeader title="FAQs" lead="Shown on the home page." />
      <Flash searchParams={searchParams} />
      <CrudList
        table="faqs"
        rows={data ?? []}
        itemTitle={(r) => r.question}
        cols={[
          { name: "question", label: "Question", required: true, wide: true },
          { name: "answer", label: "Answer", type: "textarea", required: true },
        ]}
      />
    </>
  );
}
