"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestRow } from "@/lib/types";

// Quản lý danh sách đề thi: tải, xóa. (Tạo/sửa đề nằm trong ExamCreateForm vì
// gắn chặt với state form editingTest/isSavingTest/isUploading.)
export function useTests(onError?: (message: string) => void) {
  const [tests, setTests] = useState<TestRow[]>([]);

  const loadTests = async () => {
    try {
      const { data, error: testError } = await supabase.from("tests").select("*, classes(name)").order("created_at", { ascending: false });
      if (testError) onError?.(testError.message);
      else setTests((data ?? []) as TestRow[]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTest = async (id: string, onDeleted?: (id: string) => void) => {
    if (!window.confirm("Cảnh báo: Hành động này sẽ xóa vĩnh viễn đề thi và TẤT CẢ bài nộp liên quan. Bạn có chắc chắn?")) return;

    const { error: deleteError } = await supabase.from("tests").delete().eq("id", id);
    if (deleteError) onError?.(deleteError.message);
    else {
      onDeleted?.(id);
      void loadTests();
    }
  };

  return { tests, loadTests, handleDeleteTest };
}
