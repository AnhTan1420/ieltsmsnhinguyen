"use client";

import { useState } from "react";
import { getAuthHeader } from "@/lib/supabase";
import type { SubmissionRow } from "@/lib/types";
import { downloadSubmissionsZip } from "@/lib/teacher/exportDoc";

// Chọn nhiều / Xóa hàng loạt / Tải tất cả (zip) bài nộp.
export function useBulkActions(submissions: SubmissionRow[], loadSubmissions: () => Promise<void>) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set()); // reset lựa chọn mỗi lần bật/tắt
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === submissions.length) return new Set();
      return new Set(submissions.map((s) => s.id));
    });
  };

  const handleBulkDelete = async (onDeleted?: (deletedIds: string[]) => void) => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Xóa vĩnh viễn ${selectedIds.size} bài làm đã chọn? Hành động này không thể hoàn tác.`)) return;

    setIsBulkDeleting(true);
    setError(null);

    const ids = Array.from(selectedIds);

    try {
      const response = await fetch("/api/submissions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa các bài làm đã chọn.");

      onDeleted?.(ids);
      setSelectedIds(new Set());
      setSelectionMode(false);
      void loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa các bài làm đã chọn.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Tải tất cả bài làm (zip) — nếu đang chọn nhiều thì chỉ zip các bài
  // đã chọn, ngược lại zip toàn bộ danh sách hiện có.
  const handleDownloadAll = async () => {
    const targets = selectionMode && selectedIds.size > 0 ? submissions.filter((s) => selectedIds.has(s.id)) : submissions;

    const withContent = targets.filter((s) => s.content && s.content.trim().length > 0);

    if (withContent.length === 0) {
      setError("Không có bài làm nào có nội dung để tải.");
      return;
    }

    setIsDownloadingAll(true);
    setError(null);

    try {
      await downloadSubmissionsZip(withContent);
    } catch (err) {
      setError(err instanceof Error ? `Lỗi khi tạo file zip: ${err.message}` : "Lỗi khi tạo file zip.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return {
    selectionMode,
    selectedIds,
    toggleSelectionMode,
    toggleSelectId,
    toggleSelectAll,
    isBulkDeleting,
    handleBulkDelete,
    isDownloadingAll,
    handleDownloadAll,
    bulkActionsError: error,
    setBulkActionsError: setError,
  };
}
