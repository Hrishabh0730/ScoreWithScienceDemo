import { requireAdmin } from "@/lib/auth";
import { CrudList } from "../CrudList";
import { AdminHeader, Flash, type SP } from "../ui";

export default async function Testimonials({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("testimonials").select("*").order("sort_order");
  return (
    <>
      <AdminHeader title="Testimonials" lead="Only add genuine reviews, with the student's (or parent's) permission. For minors, use first name and class only." />
      <Flash searchParams={searchParams} />
      <CrudList
        table="testimonials"
        rows={data ?? []}
        itemTitle={(r) => `${r.author_name}: “${String(r.quote).slice(0, 60)}…”`}
        cols={[
          { name: "author_name", label: "Name (e.g. first name only)", required: true },
          { name: "author_detail", label: "Detail (e.g. Class 10 ICSE)" },
          { name: "quote", label: "Review", type: "textarea", required: true },
        ]}
      />
    </>
  );
}
