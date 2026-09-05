import type { Metadata } from "next";
import PracticeWriting from "@/components/practice/PracticeWriting";

export const metadata: Metadata = {
  title: "Luyện viết IELTS Writing miễn phí - Chấm điểm AI",
  description:
    "Luyện tập IELTS Writing Task 1 và Task 2 miễn phí, không cần đăng nhập. Nhận điểm số và nhận xét chi tiết từ AI theo đúng 4 tiêu chí chấm thi IELTS.",
};

// ─────────────────────────────────────────────────────────────
// ROUTE PUBLIC — /practice
//
// CỐ TÌNH không bọc bất kỳ middleware / HOC / kiểm tra token-permission nào
// (khác với /teacher hay /test/[id], vốn cần dữ liệu thật từ Supabase). Trang
// này chỉ render 1 client component thuần, tự thân nó không đọc session,
// không đọc cookie auth, không gọi bất kỳ API nào yêu cầu đăng nhập — request
// chấm điểm đi tới /api/practice/grade, một route cũng KHÔNG kiểm tra auth
// (xem comment ở đầu file route đó). Toàn bộ người dùng, kể cả chưa từng tạo
// tài khoản, đều truy cập và luyện tập được ngay.
// ─────────────────────────────────────────────────────────────
export default function PracticePage() {
  return <PracticeWriting />;
}
