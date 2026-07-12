"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Clock,
  FileCheck2,
  FileDown,
  ShieldAlert,
  Users,
  Plus,
  Edit3,
  Copy,
  Check,
  BookOpen,
  Trash2,
  UploadCloud,
  Image as ImageIcon,
  Radio,
  Loader2,
} from "lucide-react";
import FeedbackExport from "@/components/teacher/FeedbackExport";
import { supabase } from "@/lib/supabase";
import type { SubmissionRow, TestRow } from "@/lib/types";

const statusStyles: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  disqualified: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  in_progress: "Đang làm bài",
  completed: "Đã nộp",
  disqualified: "Bị loại (gian lận)",
};

// Native .doc export — no external library.
function handleDownloadDoc(studentName: string, content: string) {
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
  const footer = "</body></html>";
  const sourceHTML =
    header +
    `<h2 style="text-align:center;">Bài làm của ${studentName}</h2><p style="white-space: pre-wrap;">${content}</p>` +
    footer;
  const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(sourceHTML);
  const fileDownload = document.createElement("a");
  document.body.appendChild(fileDownload);
  fileDownload.href = source;
  fileDownload.download = `IELTS_Writing_${studentName.replace(/\s+/g, "_")}.doc`;
  fileDownload.click();
  document.body.removeChild(fileDownload);
}

export default function TeacherDashboard() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const [activeTab, setActiveTab] = useState<"submissions" | "tests">("submissions");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingTest, setEditingTest] = useState<Partial<TestRow> | null>(null);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(Boolean(data.user));
      setAuthChecked(true);
    });
  }, []);

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) ?? submissions[0],
    [selectedId, submissions],
  );

  const loadTests = async () => {
    try {
      const { data, error: testError } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
      if (testError) setError(testError.message);
      else setTests((data ?? []) as TestRow[]);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubmissions = async () => {
    try {
      const { data, error: loadError } = await supabase
        .from("submissions")
        .select("*, tests(title, task1_prompt, task2_prompt, duration_minutes)")
        .order("created_at", { ascending: false });

      if (loadError) return setError(loadError.message);
      setSubmissions((data ?? []) as SubmissionRow[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthed) return;

    const load = async () => {
      await Promise.all([loadSubmissions(), loadTests()]);
    };
    void load();

    const channel = supabase
      .channel("teacher-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => void loadSubmissions())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthed]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTest) return;

    setIsUploading(true);
    setError(null);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `task1/${fileName}`;

    const { error: uploadError, data } = await supabase.storage.from("test-images").upload(filePath, file);

    if (uploadError) {
      setError(`Lỗi tải ảnh: ${uploadError.message}`);
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
    setError(null);

    const testData = {
      title: editingTest.title,
      task1_prompt: editingTest.task1_prompt || "",
      task2_prompt: editingTest.task2_prompt || "",
      image_url: editingTest.image_url || null,
      duration_minutes: 60,
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
    if (responseError) setError(responseError.message);
    else {
      setEditingTest(null);
      void loadTests();
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!window.confirm("Xóa vĩnh viễn đề thi và TẤT CẢ bài nộp liên quan?")) return;
    const { error: deleteError } = await supabase.from("tests").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      if (editingTest?.id === id) setEditingTest(null);
      void loadTests();
    }
  };

  const copyTestLink = (testId: string) => {
    const link = `${window.location.origin}/test/${testId}`;
    void navigator.clipboard.writeText(link);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGrade = async (submission: SubmissionRow) => {
    if (!submission.content || !submission.tests) return;
    setIsGrading(true);
    setError(null);

    const testPrompt = [submission.tests.task1_prompt, submission.tests.task2_prompt].filter(Boolean).join("\n\n");

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, content: submission.content, testPrompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Chấm bài thất bại.");
      void loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chấm bài thất bại.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleDeleteSubmission = async (submission: SubmissionRow) => {
    if (!window.confirm(`Xóa vĩnh viễn bài làm của "${submission.student_name}"?`)) return;
    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.from("submissions").delete().eq("id", submission.id);

    setIsDeleting(false);
    if (deleteError) return setError(deleteError.message);

    if (selectedId === submission.id) setSelectedId(null);
    void loadSubmissions();
  };

  if (!authChecked) {
    return <main className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">Đang tải...</main>;
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <Users className="w-14 h-14 text-cyan-300 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Cần đăng nhập để vào Teacher Dashboard</h1>
        <p className="text-slate-400 max-w-md mb-6">
          Học sinh không cần tài khoản để thi. Trang này chỉ dành cho giáo viên — vui lòng đăng nhập để tạo đề và theo
          dõi bài làm.
        </p>
        <a href="/login?next=/teacher" className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950 hover:bg-cyan-300">
          Đăng nhập
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-950 p-8 text-white shadow-xl md:flex-row md:items-end">
          <div>
            <h1 className="mt-3 text-4xl font-bold">Teacher Dashboard</h1>
            <div className="mt-6 flex gap-2 rounded-xl bg-white/5 p-1.5 w-fit border border-white/10">
              <button
                onClick={() => setActiveTab("submissions")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
                  activeTab === "submissions" ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Radio className="h-4 w-4" /> Theo dõi & Chấm bài
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
                  activeTab === "tests" ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <BookOpen className="h-4 w-4" /> Soạn đề bài viết
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-amber-50 text-amber-900 rounded-2xl border border-amber-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {activeTab === "submissions" && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200 h-fit max-h-[75vh] overflow-auto">
              <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b">
                <h2 className="text-lg font-bold">Bài làm ({submissions.length})</h2>
              </div>
              <div className="space-y-2">
                {submissions.length === 0 && (
                  <p className="text-sm text-slate-500 p-4 text-center">Chưa có học sinh nào làm bài.</p>
                )}
                {submissions.map((submission) => (
                  <button
                    key={submission.id}
                    onClick={() => setSelectedId(submission.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition ${
                      selectedSubmission?.id === submission.id
                        ? "border-cyan-400 bg-cyan-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold">{submission.student_name}</span>
                      {submission.status === "in_progress" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{submission.tests?.title ?? "Đề đã xóa"}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusStyles[submission.status] || "bg-slate-100 text-slate-700"}`}>
                        {statusLabels[submission.status] || submission.status}
                      </span>
                      {submission.warning_count > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> {submission.warning_count}/3
                        </span>
                      )}
                      {submission.band_score != null && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                          Band {submission.band_score}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              {!selectedSubmission ? (
                <div className="text-center py-24 text-slate-500">Chọn một bài làm ở danh sách bên trái.</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedSubmission.student_name}</h2>
                      <p className="text-sm text-slate-500">{selectedSubmission.tests?.title}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyles[selectedSubmission.status] || "bg-slate-100"}`}>
                      {statusLabels[selectedSubmission.status] || selectedSubmission.status}
                    </span>
                  </div>

                  {selectedSubmission.warning_count > 0 && (
                    <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm font-semibold text-amber-900">
                      <ShieldAlert className="h-4 w-4" /> Học sinh đã vi phạm quy chế {selectedSubmission.warning_count}/3 lần.
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4" /> Nội dung bài làm
                      {selectedSubmission.status === "in_progress" && (
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-600">
                          <Radio className="h-3.5 w-3.5 animate-pulse" /> Đang cập nhật trực tiếp
                        </span>
                      )}
                    </label>
                     <button
                      onClick={() =>
                        handleDownloadDoc(selectedSubmission.student_name, selectedSubmission.content ?? "")
                      }
                      disabled={!selectedSubmission.content}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      <FileDown className="h-4 w-4" /> Tải file DOC
                    </button>
                    <div className="whitespace-pre-wrap font-serif text-[15px] leading-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 max-h-[420px] overflow-auto">
                      {selectedSubmission.content?.trim() || "Học sinh chưa nhập nội dung nào..."}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                    <button
                      onClick={() => handleGrade(selectedSubmission)}
                      disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                      className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isGrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                      {selectedSubmission.feedback ? "Chấm lại bằng AI" : "Chấm bằng AI"}
                    </button>

                    {selectedSubmission.feedback && <FeedbackExport submission={selectedSubmission} />}

                   

                    <button
                      onClick={() => handleDeleteSubmission(selectedSubmission)}
                      disabled={isDeleting}
                      className="ml-auto flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" /> Xóa bài
                    </button>

                    {selectedSubmission.status === "in_progress" && (
                      <span className="text-xs text-slate-400 flex items-center gap-1 basis-full">
                        <Clock className="h-3.5 w-3.5" /> Chờ học sinh nộp bài để chấm điểm.
                      </span>
                    )}
                  </div>

                  {selectedSubmission.feedback && (
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-cyan-900">Kết quả chấm AI</h3>
                        <span className="text-2xl font-bold text-cyan-900">
                          Band {selectedSubmission.feedback.overall_band}
                        </span>
                      </div>
                      <p className="text-sm text-cyan-950">{selectedSubmission.feedback.examiner_summary}</p>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {selectedSubmission.feedback.task1 && (
                          <div className="rounded-xl bg-white border border-cyan-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-slate-800">Task 1</span>
                              <span className="rounded-full bg-cyan-100 text-cyan-900 text-sm font-bold px-2.5 py-0.5">
                                Band {selectedSubmission.feedback.task1.band}
                              </span>
                            </div>
                            <dl className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Task Achievement (TA)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task1.TA}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Coherence & Cohesion (CC)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task1.CC}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Lexical Resource (LR)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task1.LR}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Grammar Range (GRA)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task1.GRA}</dd>
                              </div>
                            </dl>
                          </div>
                        )}

                        {selectedSubmission.feedback.task2 && (
                          <div className="rounded-xl bg-white border border-cyan-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-slate-800">Task 2</span>
                              <span className="rounded-full bg-cyan-100 text-cyan-900 text-sm font-bold px-2.5 py-0.5">
                                Band {selectedSubmission.feedback.task2.band}
                              </span>
                            </div>
                            <dl className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Task Response (TR)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task2.TR}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Coherence & Cohesion (CC)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task2.CC}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Lexical Resource (LR)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task2.LR}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-slate-500">Grammar Range (GRA)</dt>
                                <dd className="font-semibold">{selectedSubmission.feedback.task2.GRA}</dd>
                              </div>
                            </dl>
                          </div>
                        )}
                      </div>

                      {/* FIXED: Thêm Optional Chaining để chống sập nếu AI không có corrections */}
                      {selectedSubmission.feedback.corrections && selectedSubmission.feedback.corrections.length > 0 && (
                        <div>
                          <h4 className="font-bold text-cyan-900 mb-3">Lỗi và đề xuất sửa</h4>
                          <div className="space-y-3">
                            {selectedSubmission.feedback.corrections.map((correction, index) => (
                              <div
                                key={`${index}`}
                                className="rounded-xl bg-white border border-slate-200 p-4 space-y-2"
                              >
                                <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-800 line-through decoration-red-400">
                                  {correction.original}
                                </p>
                                <p className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-800 font-medium">
                                  {correction.corrected}
                                </p>
                                <p className="flex items-start gap-2 text-xs text-slate-600">
                                  <Bot className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                                  {correction.explanation}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "tests" && (
          <section className="grid gap-6 lg:grid-cols-[1fr_450px]">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <div className="flex justify-between border-b pb-4 mb-4">
                <h2 className="text-xl font-bold">Danh sách đề thi</h2>
                <button
                  onClick={() => setEditingTest({ title: "", task1_prompt: "", task2_prompt: "", image_url: null })}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                >
                  <Plus className="h-4 w-4" /> Tạo đề mới
                </button>
              </div>
              <div className="space-y-4 max-h-[650px] overflow-auto pr-2">
                {tests.map((test) => (
                  <div key={test.id} className="p-5 border rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition space-y-3">
                    <div className="flex justify-between">
                      <h3 className="font-bold text-lg">{test.title}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingTest(test)} className="p-2 text-slate-600 hover:text-cyan-600">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteTest(test.id)} className="p-2 text-slate-600 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => copyTestLink(test.id)} className="p-2 text-slate-600 hover:text-emerald-600">
                          {copiedId === test.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Thời gian làm bài: {test.duration_minutes} phút</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 h-fit sticky top-6">
              <h2 className="text-xl font-bold border-b pb-4 mb-4">{editingTest?.id ? "Sửa đề thi" : "Tạo đề thi (Full Test)"}</h2>
              {editingTest ? (
                <form onSubmit={handleSaveTest} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tiêu đề chung</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border p-3 text-sm focus:border-cyan-500 focus:outline-none"
                      value={editingTest.title || ""}
                      onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <ImageIcon className="h-4 w-4 text-cyan-600" /> Task 1 (có đề bài + ảnh minh họa)
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Câu hỏi Task 1</label>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border p-3 text-sm focus:border-cyan-500 focus:outline-none"
                        value={editingTest.task1_prompt || ""}
                        onChange={(e) => setEditingTest({ ...editingTest, task1_prompt: e.target.value })}
                        placeholder="The graph below shows..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh minh họa (Biểu đồ/Bản đồ)</label>
                      {editingTest.image_url ? (
                        <div className="mb-2 relative w-full h-32 rounded-lg border overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editingTest.image_url} alt="Task 1" className="object-contain w-full h-full bg-white" />
                          <button
                            type="button"
                            onClick={() => setEditingTest({ ...editingTest, image_url: null })}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-100 bg-white border-slate-300">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500">
                            {isUploading ? <Clock className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6 mb-2" />}
                            <p className="text-xs font-semibold">{isUploading ? "Đang tải ảnh..." : "Click để tải ảnh lên"}</p>
                          </div>
                          <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} disabled={isUploading} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <BookOpen className="h-4 w-4 text-cyan-600" /> Task 2 (chỉ có đề bài)
                    </div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Câu hỏi Task 2</label>
                    <textarea
                      rows={4}
                      className="w-full rounded-lg border p-3 text-sm focus:border-cyan-500 focus:outline-none"
                      value={editingTest.task2_prompt || ""}
                      onChange={(e) => setEditingTest({ ...editingTest, task2_prompt: e.target.value })}
                      placeholder="Some people think..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <button type="button" onClick={() => setEditingTest(null)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-slate-50">
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTest}
                      className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      Lưu đề thi
                    </button>
                  </div>

                  {/* ĐÃ FIX: Phần code cuối bị cắt cụt đã được hoàn thiện */}
                  {editingTest.id && (
                    <button
                      type="button"
                      onClick={() => copyTestLink(editingTest.id!)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {copiedId === editingTest.id ? (
                        <>
                          <Check className="h-4 w-4" /> Đã copy link
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" /> Copy link đề thi
                        </>
                      )}
                    </button>
                  )}
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                  <BookOpen className="h-12 w-12 text-slate-300 mb-4" />
                  <p>Chọn một đề thi bên trái để chỉnh sửa<br />hoặc bấm "Tạo đề mới".</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}