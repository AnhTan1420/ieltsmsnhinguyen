import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAuth } from "@/lib/auth-server";

// Periodic autosave while the student is typing. This is what lets the teacher
// dashboard show the essay "live" before it's submitted.
//
// This stays PUBLIC/no-auth for the student-facing fields (content, end_reason,
// status) — anonymous students never have accounts. BUT `teacher_comment` is a
// teacher-only field, so if it's present in the body we require a valid teacher
// session before touching anything.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, end_reason, status, teacher_comment } = (await request.json()) as {
    content?: string;
    end_reason?: string;
    status?: string;
    teacher_comment?: string;
  };

  const hasContent = typeof content === "string";
  const hasTeacherComment = typeof teacher_comment === "string";

  if (!hasContent && !end_reason && !status && !hasTeacherComment) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (hasTeacherComment) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("submissions")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Nhận xét của giáo viên có thể lưu bất kể trạng thái bài làm, nhưng các
  // trường của học sinh (autosave) thì vẫn tôn trọng khóa "đã hoàn tất" như cũ.
  if (submission.status !== "in_progress" && !status && !hasTeacherComment) {
    // Test already finished — silently ignore late autosave pings.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const updateData: {
    content?: string;
    end_reason?: string;
    status?: string;
    submitted_at?: string;
    teacher_comment?: string;
  } = {};

  if (hasContent) {
    updateData.content = content;
  }
  if (end_reason) {
    updateData.end_reason = end_reason;
  }
  if (status) {
    updateData.status = status;
    // Set submitted_at when status changes to disqualified or submitted
    if (status === "disqualified" || status === "submitted") {
      updateData.submitted_at = new Date().toISOString();
    }
  }
  if (hasTeacherComment) {
    updateData.teacher_comment = teacher_comment;
  }

  const { error } = await supabaseAdmin.from("submissions").update(updateData).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Xóa một bài nộp — chỉ giáo viên đã đăng nhập mới được gọi. Bảng submissions
// không có RLS policy cho phép anon/authenticated client tự ý DELETE, nên thao
// tác này bắt buộc phải đi qua route này (dùng service-role key) thay vì gọi
// thẳng supabase.from("submissions").delete() từ trình duyệt.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin.from("submissions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
