"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Check, Clock, Copy, Edit3, Image as ImageIcon, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { TestRow } from "@/lib/types";
import { useTests } from "@/hooks/teacher/useTests";

type ExamCreateFormProps = {
  onError: (message: string) => void;
};

// Tab "Quản lý đề thi" — ngân hàng đề (danh sách + xóa) và form khởi tạo/chỉnh sửa đề (tạo/upload ảnh).
export default function ExamCreateForm({ onError }: ExamCreateFormProps) {
  const { tests, loadTests, handleDeleteTest } = useTests(onError);

  const [editingTest, setEditingTest] = useState<Partial<TestRow> | null>(null);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Trên mobile, danh sách đề và form soạn/sửa đề không đủ chỗ hiện song song —
  // dùng chính trạng thái editingTest (null = đang xem danh sách, có giá trị =
  // đang soạn/sửa 1 đề) làm cờ chuyển "màn hình", giống điều hướng master-detail
  // ở tab "Theo dõi & Chấm bài". Ở lg+ cả 2 cột luôn hiện song song như cũ.
  const showEditorOnMobile = editingTest !== null;

  useEffect(() => {
    void loadTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTest) return;

    setIsUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `task1/${fileName}`;

    const { error: uploadError, data } = await supabase.storage.from("test-images").upload(filePath, file);

    if (uploadError) {
      onError(`Lỗi tải ảnh: ${uploadError.message}`);
    } else if (data) {
      const { data: publicUrlData } = supabase.storage.from("test-images").getPublicUrl(filePath);
      setEditingTest({ ...editingTest, image_url: publicUrlData.publicUrl });
    }
    setIsUploading(false);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest?.title) return;

    setIsSavingTest(true);

    const testData = {
      title: editingTest.title,
      task1_prompt: editingTest.task1_prompt || "",
      task2_prompt: editingTest.task2_prompt || "",
      image_url: editingTest.image_url || null,
      duration_minutes: editingTest.duration_minutes && editingTest.duration_minutes > 0 ? editingTest.duration_minutes : 60,
    };

    let responseError = null;
    if (editingTest.id) {
      const { error: updateError } = await supabase.from("tests").update(testData).eq("id", editingTest.id);
      responseError = updateError;
    } else {
      const { error: insertError } = await supabase.from("tests").insert([testData]);
      responseError = insertError;
    }

    setIsSavingTest(false);
    if (responseError) onError(responseError.message);
    else {
      setEditingTest(null);
      void loadTests();
    }
  };

  const copyTestLink = (testId: string) => {
    const link = `${window.location.origin}/test/${testId}`;
    void navigator.clipboard.writeText(link);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="grid gap-6 items-start lg:grid-cols-[1fr_450px]">
      <div className={`${showEditorOnMobile ? "hidden lg:block" : "block"} rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200/60 lg:sticky lg:top-24`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5 mb-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">Ngân hàng Đề thi</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Danh sách các đề IELTS Writing bạn đã tạo</p>
          </div>
          <button
            onClick={() => setEditingTest({ title: "", task1_prompt: "", task2_prompt: "", image_url: null, duration_minutes: 60 })}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 sm:px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Soạn đề mới</span>
          </button>
        </div>

        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <BookOpen className="h-8 w-8 mb-2 text-slate-300" />
            <p className="text-sm font-medium">Chưa có đề thi nào. Bấm "Soạn đề mới" để bắt đầu.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto pr-0 lg:pr-2 custom-scrollbar">
            {tests.map((test) => (
              <div key={test.id} className="p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white hover:border-cyan-300 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-cyan-400 transition-colors"></div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h3 className="font-bold text-lg text-slate-800 group-hover:text-cyan-800 pl-2 pr-1 min-w-0 break-words">{test.title}</h3>
                  {/* Luôn hiện sẵn (không chỉ khi hover) — trên cảm ứng không có hover ổn định */}
                  <div className="flex shrink-0 gap-0.5 sm:gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                    <button onClick={() => setEditingTest(test)} className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-md transition" title="Sửa đề">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTest(test.id, (id) => setEditingTest((prev) => (prev?.id === id ? null : prev)))}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition"
                      title="Xóa đề"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => copyTestLink(test.id)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-md transition" title="Copy Link">
                      {copiedId === test.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="pl-2 flex items-center gap-4 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {test.duration_minutes} phút</span>
                  <span className="hidden sm:flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Full Test (Task 1 & 2)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${showEditorOnMobile ? "block" : "hidden lg:block"} rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200/60 lg:sticky lg:top-24`}>
        {editingTest && (
          <button
            type="button"
            onClick={() => setEditingTest(null)}
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
          <form onSubmit={handleSaveTest} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề chung</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-sm"
                value={editingTest.title || ""}
                onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
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
                  setEditingTest({
                    ...editingTest,
                    duration_minutes: raw === "" ? undefined : Math.max(1, parseInt(raw, 10) || 1),
                  });
                }}
                placeholder="60"
                required
              />
              <p className="text-xs text-slate-400 mt-1.5">Mặc định 60 phút. Học sinh sẽ bị tự động nộp bài khi hết thời gian.</p>
            </div>

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
                  onChange={(e) => setEditingTest({ ...editingTest, task1_prompt: e.target.value })}
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
                      onClick={() => setEditingTest({ ...editingTest, image_url: null })}
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
                    <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} disabled={isUploading} />
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
                  onChange={(e) => setEditingTest({ ...editingTest, task2_prompt: e.target.value })}
                  placeholder="Some people think that..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setEditingTest(null)} className="flex-1 rounded-xl border border-slate-200 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSavingTest}
                className="flex-[2] rounded-xl bg-cyan-500 py-3.5 text-sm font-bold text-slate-900 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50"
              >
                {isSavingTest ? "Đang lưu..." : "Lưu Đề thi"}
              </button>
            </div>

            {editingTest.id && (
              <button
                type="button"
                onClick={() => copyTestLink(editingTest.id!)}
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
            <p className="text-sm font-medium">Bấm vào nút <strong className="text-slate-700">"Soạn đề mới"</strong><br />hoặc chọn đề từ danh sách để bắt đầu.</p>
          </div>
        )}
      </div>
    </section>
  );
}
