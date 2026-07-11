import StudentTest from "@/components/test/StudentTest";
import { supabase } from "@/lib/supabase";

// Hàm kiểm tra chuỗi ký tự có phải là mã UUID hợp lệ không
const isValidUUID = (str: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 1. Kiểm tra định dạng ID đầu vào. Nếu link sai định dạng UUID thì từ chối luôn.
  if (!isValidUUID(id)) {
    return (
      <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-950">
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-md w-full border border-slate-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Đường dẫn không hợp lệ</h1>
          <p className="text-slate-500 mb-6">Mã đề thi không đúng định dạng. Vui lòng kiểm tra lại đường dẫn từ giáo viên.</p>
          <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl font-mono break-all">ID cung cấp: {id}</div>
        </div>
      </main>
    );
  }

  // 2. Lấy dữ liệu thực tế (Title, Task 1, Task 2, Ảnh) từ Database
  const { data: test, error } = await supabase
    .from("tests")
    .select("id, title, task1_prompt, task2_prompt, image_url, duration_minutes")
    .eq("id", id)
    .single();

  // 3. Nếu không tìm thấy đề trong DB (bị xóa hoặc sai ID thực tế) -> Hiện thông báo lỗi
  if (error || !test) {
    return (
      <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-950">
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-md w-full border border-slate-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Không tìm thấy đề thi</h1>
          <p className="text-slate-500 mb-6">Đề bài này không tồn tại hoặc đã bị giáo viên gỡ bỏ khỏi hệ thống.</p>
          <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl font-mono break-all">ID tìm kiếm: {id}</div>
        </div>
      </main>
    );
  }

  // 4. Nếu tìm thấy, truyền chuẩn dữ liệu thật sang giao diện làm bài của Học sinh
  return (
    <StudentTest
      testId={test.id}
      title={test.title}
      task1Prompt={test.task1_prompt}
      task2Prompt={test.task2_prompt}
      imageUrl={test.image_url}
      durationMinutes={test.duration_minutes ?? 60}
    />
  );
}