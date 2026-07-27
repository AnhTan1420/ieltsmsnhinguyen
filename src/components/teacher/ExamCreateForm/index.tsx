"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestRow } from "@/lib/types";
import { useTests } from "@/hooks/teacher/useTests";
import { useClasses } from "@/hooks/teacher/useClasses";
import TestBankList from "./TestBankList";
import TestEditorForm from "./TestEditorForm";

type ExamCreateFormProps = {
  onError: (message: string) => void;
};

// Tab "Quản lý đề thi" — điều phối state (đề đang sửa, cờ đang lưu/đang tải
// ảnh) và handler (lưu đề, upload ảnh, copy link), ghép cột trái TestBankList
// + cột phải TestEditorForm lại. Toàn bộ JSX chi tiết nằm ở 2 file con.
export default function ExamCreateForm({ onError }: ExamCreateFormProps) {
  const { tests, loadTests, handleDeleteTest } = useTests(onError);
  const { classes, loadClasses } = useClasses(onError);

  const [editingTest, setEditingTest] = useState<Partial<TestRow> | null>(null);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Trên mobile, danh sách đề và form soạn/sửa đề không đủ chỗ hiện song song —
  // dùng chính trạng thái editingTest (null = đang xem danh sách, có giá trị =
  // đang soạn/sửa 1 đề) làm cờ chuyển "màn hình", giống điều hướng master-detail
  // ở tab "Theo dõi & Chấm bài". Ở lg+ cả 2 cột luôn hiện song song như cũ.
  const showEditorOnMobile = editingTest !== null;

  useEffect(() => {
    void loadTests();
    void loadClasses();
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
    setJustSaved(false);

    const testData = {
      title: editingTest.title,
      task1_prompt: editingTest.task1_prompt || "",
      task2_prompt: editingTest.task2_prompt || "",
      image_url: editingTest.image_url || null,
      duration_minutes: editingTest.duration_minutes && editingTest.duration_minutes > 0 ? editingTest.duration_minutes : 60,
      class_id: editingTest.class_id || null,
      block_copy_paste: editingTest.block_copy_paste ?? false,
    };

    let responseError = null;
    let savedId = editingTest.id;

    if (editingTest.id) {
      const { error: updateError } = await supabase.from("tests").update(testData).eq("id", editingTest.id);
      responseError = updateError;
    } else {
      // .select().single() để lấy lại id vừa tạo — cần id này để nút "Copy Link"
      // hiện ra ngay sau lần lưu đầu tiên, và để lần "Lưu Đề thi" tiếp theo là
      // update (có id) thay vì insert thêm 1 bản ghi trùng.
      const { data: insertedData, error: insertError } = await supabase.from("tests").insert([testData]).select().single();
      responseError = insertError;
      if (!insertError && insertedData) savedId = insertedData.id;
    }

    setIsSavingTest(false);
    if (responseError) onError(responseError.message);
    else {
      // Giữ nguyên panel "Chỉnh sửa Đề thi" thay vì tự động đóng về danh sách —
      // giáo viên thường lưu rồi xem/sửa tiếp ngay, đóng panel làm mất ngữ cảnh
      // và phải bấm lại "Sửa đề" từ danh sách. Chỉ cập nhật id (nếu là đề mới)
      // và hiện chữ "Đã lưu" thoáng qua để xác nhận việc lưu đã thành công.
      setEditingTest({ ...editingTest, id: savedId });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
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
      <TestBankList
        tests={tests}
        copiedId={copiedId}
        showOnMobile={!showEditorOnMobile}
        onEdit={setEditingTest}
        onDelete={(id) => handleDeleteTest(id, (deletedId) => setEditingTest((prev) => (prev?.id === deletedId ? null : prev)))}
        onCopyLink={copyTestLink}
        onCreateNew={() => setEditingTest({ title: "", task1_prompt: "", task2_prompt: "", image_url: null, duration_minutes: 60, block_copy_paste: false })}
      />

      <TestEditorForm
        editingTest={editingTest}
        classes={classes}
        isSavingTest={isSavingTest}
        justSaved={justSaved}
        isUploading={isUploading}
        copiedId={copiedId}
        showOnMobile={showEditorOnMobile}
        onChange={setEditingTest}
        onCancelEdit={() => setEditingTest(null)}
        onSubmit={handleSaveTest}
        onImageUpload={handleImageUpload}
        onCopyLink={copyTestLink}
      />
    </section>
  );
}
