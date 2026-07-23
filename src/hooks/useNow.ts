"use client";

import { useEffect, useState } from "react";

// Trả về Date.now() và tự re-render component mỗi `intervalMs` — dùng cho các
// nhãn kiểu "cập nhật X giây trước" cần tự nhảy số theo thời gian thực dù dữ
// liệu gốc (updated_at) không đổi. Không gọi mạng, chỉ tick đồng hồ ở client.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
