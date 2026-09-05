"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";

type ChartImageDropzoneProps = {
  // URL (http(s) hoặc data:) đang hiển thị làm preview — null/undefined = chưa có ảnh.
  imageUrl?: string | null;
  isUploading?: boolean;
  // Nhận File thô, không phải ChangeEvent — để component này dùng được ở mọi
  // nơi (nơi thì upload lên Supabase Storage rồi lưu public URL, nơi khác chỉ
  // cần đọc thành base64 data URL trên trình duyệt, không cần backend).
  onFileSelected: (file: File) => void;
  onRemove: () => void;
  // Báo lỗi file không hợp lệ (sai định dạng) lên component cha để tự hiển thị
  // theo đúng style thông báo lỗi của từng trang — component này không tự vẽ toast.
  onInvalidFile?: (message: string) => void;
  hint?: string;
  accept?: string;
};

const DEFAULT_ACCEPT = "image/png, image/jpeg, image/webp";

// Ô chọn/kéo-thả ảnh biểu đồ Task 1 — TÁCH RA từ khối "Ảnh Biểu đồ / Bản đồ"
// vốn nằm nguyên trong TestEditorForm.tsx (tab "Quản lý đề thi" ở /teacher),
// bổ sung thêm khả năng KÉO-THẢ file (bản gốc chỉ bấm-để-chọn qua input file
// ẩn) để dùng chung được ở cả 2 nơi:
//  - TestEditorForm (giáo viên soạn đề — nguồn logic gốc)
//  - PracticeWriting (trang /practice public — học sinh luyện tập tự do)
// Component thuần hiển thị + tương tác kéo-thả; việc file sau khi chọn đi đâu
// (upload Supabase Storage hay đọc base64 tại chỗ) là do component cha quyết
// định qua onFileSelected.
export default function ChartImageDropzone({
  imageUrl,
  isUploading = false,
  onFileSelected,
  onRemove,
  onInvalidFile,
  hint,
  accept = DEFAULT_ACCEPT,
}: ChartImageDropzoneProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Đếm số lần dragenter/dragleave thay vì dùng 1 boolean đơn giản — khi kéo
  // file ngang qua các phần tử con bên trong dropzone, trình duyệt bắn thêm
  // dragenter/dragleave cho từng phần tử con đó, dẫn tới dragleave "giả" dù
  // con trỏ vẫn còn nằm trong dropzone. Đếm net (enter - leave) tránh việc
  // highlight bị tắt/nhấp nháy giữa chừng khi kéo qua icon/text bên trong.
  const dragCounter = useRef(0);

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onInvalidFile?.("Vui lòng chọn một tệp ảnh (PNG, JPG, WEBP).");
      return;
    }
    onFileSelected(file);
  }

  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    dragCounter.current += 1;
    setIsDraggingOver(true);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    // Bắt buộc phải preventDefault ở đây — mặc định trình duyệt sẽ TỪ CHỐI
    // thả file (con trỏ hiện icon "cấm") nếu dragover không bị chặn hành vi gốc.
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    if (isUploading) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  if (imageUrl) {
    return (
      <div className="mb-2 relative w-full h-40 rounded-xl border border-slate-200 overflow-hidden bg-white group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Task 1" className="object-contain w-full h-full p-2" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-lg transition-all"
          title="Xóa ảnh"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all group ${
          isUploading
            ? "cursor-not-allowed bg-slate-50 border-slate-200"
            : isDraggingOver
              ? "cursor-copy bg-cyan-50 border-cyan-400 ring-4 ring-cyan-500/10"
              : "cursor-pointer hover:bg-slate-100 hover:border-cyan-300 bg-white border-slate-300"
        }`}
      >
        <div
          className={`flex flex-col items-center justify-center pt-5 pb-6 text-center transition-colors ${
            isDraggingOver ? "text-cyan-600" : "text-slate-500 group-hover:text-cyan-600"
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 mb-2 animate-spin text-cyan-500" />
          ) : (
            <UploadCloud className="w-8 h-8 mb-2" />
          )}
          <p className="text-xs font-bold px-4">
            {isUploading
              ? "Đang tải ảnh lên..."
              : isDraggingOver
                ? "Thả ảnh vào đây"
                : "Kéo & thả ảnh vào đây, hoặc chạm để chọn"}
          </p>
          {hint && !isUploading && <p className="mt-1 text-[11px] font-medium text-slate-400 px-4">{hint}</p>}
        </div>
        <input
          type="file"
          className="hidden"
          accept={accept}
          disabled={isUploading}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            // Cho phép chọn lại đúng file vừa chọn (VD: chọn nhầm rồi chọn lại
            // chính file đó) — nếu không reset, onChange sẽ không bắn lần 2 vì
            // value input không đổi.
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
