"use client";

import { Check, FileCheck2, Loader2 } from "lucide-react";

type TeacherCommentBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
};

// Ô "Nhận xét bổ sung của giáo viên" — nhận xét thủ công, độc lập với nhận xét AI.
export default function TeacherCommentBox({ value, onChange, onSave, isSaving }: TeacherCommentBoxProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
      <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-slate-500" /> Nhận xét bổ sung của giáo viên
      </label>
      <textarea
        rows={4}
        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none shadow-sm"
        placeholder="Viết nhận xét cho học sinh..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50 w-full sm:w-auto"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Gửi nhận xét
        </button>
      </div>
    </div>
  );
}
