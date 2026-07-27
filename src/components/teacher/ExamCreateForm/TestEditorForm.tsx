"use client";

import { ArrowLeft, BookOpen, Check, ClipboardX, Clock, Copy, GraduationCap, Image as ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import type { ClassRow, TestRow } from "@/lib/types";

type TestEditorFormProps = {
  editingTest: Partial<TestRow> | null;
  classes: ClassRow[];
  isSavingTest: boolean;
  justSaved: boolean;
  isUploading: boolean;
  copiedId: string | null;
  showOnMobile: boolean;
  onChange: (next: Partial<TestRow>) => void;
  onCancelEdit: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCopyLink: (testId: string) => void;
};

// Cột phải "Khởi tạo/Chỉnh sửa Đề thi" — form đầy đủ (tiêu đề, thời lượng, lớp,
// chặn copy/paste, đề bài + ảnh Task 1, đề bài Task 2) hoặc trạng thái rỗng khi
// chưa chọn đề nào. Component thuần hiển thị — mọi state nằm ở ExamCreateForm.
export default function TestEditorForm({
  editingTest,
  classes,
  isSavingTest,
  justSaved,
  isUploading,
  copiedId,
  showOnMobile,
  onChange,
  onCancelEdit,
  onSubmit,
  onImageUpload,
  onCopyLink,
}: TestEditorFormProps) {
  return (
    <div className={`${showOnMobile ? "block" : "hidden lg:block"} rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200/60 lg:sticky lg:top-24`}>
      {editingTest && (
        <button
          type="button"
          onClick={onCancelEdit}
          className="flex lg:hidden items-center gap-1.5 -mt-1 mb-4 text-sm font-bold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Ngân hàng đề thi
        </button>
      )}

      <div className="border-b border-slate-100 pb-5 mb-6">
        <h2 className="text-xl font-bold text-slate-900">{editingTest?.id ? "Chỉnh sửa Đề thi" : "Khởi tạo Đề thi Mới"}</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {editingTest?.id ? "Cập nhật nội dung câu hỏi hoặc ảnh minh họa." : "Tạo bài thi chuẩn format IELTS Writing."}
        </p>
      </div>

      {editingTest ? (
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề chung</label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-sm"
              value={editingTest.title || ""}
              onChange={(e) => onChange({ ...editingTest, title: e.target.value })}
              placeholder="VD: Mock Test 01 - Academic"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-600" /> Thời gian làm bài (phút)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              className="w-full sm:w-48 rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-sm"
              value={editingTest.duration_minutes ?? 60}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...editingTest,
                  duration_minutes: raw === "" ? undefined : Math.max(1, parseInt(raw, 10) || 1),
                });
              }}
              placeholder="60"
              required
            />
            <p className="text-xs text-slate-400 mt-1.5">Mặc định 60 phút. Học sinh sẽ bị tự động nộp bài khi hết thời gian.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-cyan-600" /> Lớp học
            </label>
            <select
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-sm bg-white"
              value={editingTest.class_id || ""}
              onChange={(e) => onChange({ ...editingTest, class_id: e.target.value || null })}
            >
              <option value="">— Chưa phân lớp —</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            {classes.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">Chưa có lớp học nào. Tạo lớp ở tab &quot;Quản lý lớp học&quot; trước.</p>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 cursor-pointer hover:border-cyan-300 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500/40"
              checked={editingTest.block_copy_paste ?? false}
              onChange={(e) => onChange({ ...editingTest, block_copy_paste: e.target.checked })}
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <ClipboardX className="h-4 w-4 text-cyan-600" /> Chặn copy/paste
              </span>
              <span className="block text-xs text-slate-400 mt-1">
                Khi bật, học sinh sẽ không thể copy/paste ở trang làm bài. Khi tắt, học sinh copy/paste bình thường.
              </span>
            </span>
          </label>

          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 font-black text-slate-800 text-base">
              <ImageIcon className="h-5 w-5 text-cyan-600" /> Writing Task 1
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Yêu cầu đề bài</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none shadow-sm"
                value={editingTest.task1_prompt || ""}
                onChange={(e) => onChange({ ...editingTest, task1_prompt: e.target.value })}
                placeholder="The graph below shows..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Ảnh Biểu đồ / Bản đồ</label>
              {editingTest.image_url ? (
                <div className="mb-2 relative w-full h-40 rounded-xl border border-slate-200 overflow-hidden bg-white group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editingTest.image_url} alt="Task 1" className="object-contain w-full h-full p-2" />
                  <button
                    type="button"
                    onClick={() => onChange({ ...editingTest, image_url: null })}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-lg transition-all"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 hover:border-cyan-300 bg-white border-slate-300 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 group-hover:text-cyan-600 transition-colors">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                    ) : (
                      <UploadCloud className="w-8 h-8 mb-2" />
                    )}
                    <p className="text-xs font-bold">{isUploading ? "Đang tải ảnh lên máy chủ..." : "Chạm để chọn ảnh từ thiết bị"}</p>
                  </div>
                  <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={onImageUpload} disabled={isUploading} />
                </label>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 font-black text-slate-800 text-base">
              <BookOpen className="h-5 w-5 text-cyan-600" /> Writing Task 2
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Yêu cầu đề bài</label>
              <textarea
                rows={5}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none shadow-sm"
                value={editingTest.task2_prompt || ""}
                onChange={(e) => onChange({ ...editingTest, task2_prompt: e.target.value })}
                placeholder="Some people think that..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onCancelEdit} className="flex-1 rounded-xl border border-slate-200 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSavingTest}
              className="flex-[2] rounded-xl bg-cyan-500 py-3.5 text-sm font-bold text-slate-900 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50"
            >
              {isSavingTest ? "Đang lưu..." : justSaved ? "✓ Đã lưu" : "Lưu Đề thi"}
            </button>
          </div>

          {editingTest.id && (
            <button
              type="button"
              onClick={() => onCopyLink(editingTest.id!)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 py-3.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors mt-2"
            >
              {copiedId === editingTest.id ? (
                <>
                  <Check className="h-5 w-5" /> Đã sao chép Link Gửi cho Học sinh
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" /> Copy Link thi để gửi cho Học sinh
                </>
              )}
            </button>
          )}
        </form>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-center px-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-4">
            <BookOpen className="h-8 w-8 text-cyan-200" />
          </div>
          <p className="text-sm font-medium">
            Bấm vào nút <strong className="text-slate-700">&quot;Soạn đề mới&quot;</strong>
            <br />
            hoặc chọn đề từ danh sách để bắt đầu.
          </p>
        </div>
      )}
    </div>
  );
}
