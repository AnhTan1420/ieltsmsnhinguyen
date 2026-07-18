import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "development-placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Các API route "chỉ dành cho giáo viên" (grade, xóa bài nộp, lưu nhận xét...)
// xác thực bằng access token JWT của session hiện tại, gửi qua header
// Authorization: Bearer <token>. Hàm này lấy header đó để gắn vào mỗi fetch().
// Nếu chưa đăng nhập (session null) thì trả về object rỗng — request sẽ đi
// mà không có token và bị API trả về 401, đúng như mong đợi.
export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
