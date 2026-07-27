// CSS toàn cục cho 2 class tiện ích dùng khắp dashboard giáo viên:
// .custom-scrollbar (thanh cuộn mảnh, chỉ hiện màu khi hover — dùng cho các
// cột cuộn riêng như danh sách bài nộp) và .no-scrollbar (ẩn hẳn thanh cuộn —
// dùng cho các hàng cuộn ngang như thanh tab lọc lớp học). Tách riêng thành
// component để không phải nhìn 1 khối <style> dài giữa JSX của trang chính.
export default function ScrollbarStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        html { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar { display: none; }
      `,
      }}
    />
  );
}
