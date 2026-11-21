import { requireAdmin } from "@/lib/auth";
import { CrudList } from "../CrudList";
import { AdminHeader, Flash, type SP } from "../ui";

export default async function Videos({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("videos").select("*").order("sort_order").order("created_at", { ascending: false });
  return (
    <>
      <AdminHeader title="YouTube videos" lead="Paste a video link — the thumbnail is fetched from YouTube automatically. The channel link is under Website content." />
      <Flash searchParams={searchParams} />
      <CrudList
        table="videos"
        rows={data ?? []}
        itemTitle={(r) => r.title}
        cols={[
          { name: "youtube_url", label: "Video URL", required: true, placeholder: "https://www.youtube.com/watch?v=…", wide: true },
          { name: "title", label: "Title", required: true, wide: true },
          { name: "class_level", label: "Class", type: "select", options: [["", "Any"], ["8", "Class 8"], ["9", "Class 9"], ["10", "Class 10"]] },
          { name: "board", label: "Board", type: "select", options: [["", "Any"], ["CBSE", "CBSE"], ["ICSE", "ICSE"]] },
          { name: "chapter", label: "Chapter" },
          { name: "thumbnail_url", label: "Custom thumbnail URL (optional)", placeholder: "https://i.ytimg.com/…" },
        ]}
      />
    </>
  );
}
