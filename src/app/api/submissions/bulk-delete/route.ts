import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAuth } from "@/lib/auth-server";

// Xóa nhiều bài nộp cùng lúc — chỉ giáo viên đã đăng nhập mới được gọi.
// Cùng lý do bảo mật như DELETE /api/submissions/[id]: bảng submissions không
// có RLS policy cho phép client tự ý xóa, nên thao tác hàng loạt phải đi qua
// route này (service-role key) thay vì gọi thẳng từ trình duyệt.
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { ids } = (await request.json()) as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Missing or invalid ids" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("submissions").delete().in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedCount: ids.length });
}
