import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Xác thực request tới các API route "chỉ dành cho giáo viên".
 *
 * Toàn bộ hệ thống dùng mô hình single-role: bất kỳ ai có một session
 * Supabase Auth hợp lệ (đã đăng nhập) đều được coi là giáo viên. Vì vậy điều
 * kiện bắt buộc ở tầng server là: request phải mang theo access token JWT hợp
 * lệ, CHƯA hết hạn và CHƯA bị thu hồi.
 *
 * Quan trọng: không được tự giải mã JWT rồi tin luôn payload (id/email...),
 * vì bất kỳ ai cũng có thể tạo ra một chuỗi trông giống JWT. Ta phải gọi
 * `auth.getUser(token)` để Supabase Auth server xác minh chữ ký + hạn dùng
 * + trạng thái thu hồi của token, rồi mới trả về user thật tương ứng.
 */
export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  // Client "trần" (không phải service role) — dùng đúng token của người gọi
  // để hỏi Auth server "token này còn hợp lệ không, của ai".
  const supabaseAuthClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

/**
 * Dùng ở đầu mỗi API route yêu cầu đăng nhập. Trả về user nếu hợp lệ,
 * hoặc một NextResponse 401 sẵn sàng để `return` thẳng ra nếu không.
 *
 * Cách dùng:
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth ở đây chắc chắn là User đã xác thực
 */
export async function requireAuth(request: Request): Promise<User | NextResponse> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Vui lòng đăng nhập lại để thực hiện thao tác này." },
      { status: 401 },
    );
  }
  return user;
}
