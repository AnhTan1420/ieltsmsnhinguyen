"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Kiểm tra đăng nhập giáo viên + tự động đăng xuất sau 30 phút không hoạt động.
export function useTeacherAuth() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Một số lỗi (ví dụ đồng hồ thiết bị lệch giờ khiến JWT bị coi là
      // "issued at future") có thể khiến signOut() ném lỗi thay vì trả về
      // { error }. Vẫn tiếp tục điều hướng về /login để không kẹt người dùng
      // lại ở trang cũ với phiên đã hết hạn.
      console.error("Đăng xuất gặp lỗi (bỏ qua, vẫn chuyển về trang đăng nhập):", err);
    }
    router.push("/login"); // Chuyển về trang login
  };

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setIsAuthed(Boolean(data.user));
      })
      .catch((err) => {
        // Lỗi thường gặp: "JWT issued at future" khi đồng hồ hệ thống của
        // thiết bị bị lệch giờ so với thực tế. Trong trường hợp này, coi như
        // chưa đăng nhập thay vì để lỗi rơi ra ngoài làm crash trang.
        console.error("Không xác thực được phiên đăng nhập:", err);
        setIsAuthed(false);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  // Logic Auto Sign Out sau 30 phút (1,800,000 ms)
  useEffect(() => {
    if (!isAuthed) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void handleSignOut();
        alert("Phiên làm việc đã hết hạn sau 30 phút không hoạt động.");
      }, 1000 * 60 * 30); // 30 phút
    };

    // Lắng nghe các hành động của người dùng
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);

    // Khởi tạo bộ đếm lần đầu
    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  return { authChecked, isAuthed, handleSignOut };
}
