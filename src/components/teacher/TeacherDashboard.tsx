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
  Sparkles,
  ChevronRight,
  LogOut,
  Download // Đã import thêm icon Download
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { SubmissionRow, TestRow } from "@/lib/types";
import { useRouter } from "next/navigation";

const statusStyles: Record<string, string> = {
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disqualified: "bg-red-50 text-red-700 border-red-200",
};

const statusLabels: Record<string, string> = {
  in_progress: "Đang làm bài",
  completed: "Đã nộp",
  disqualified: "Hủy bài làm",
};

// Nâng cấp: Export File DOC đính kèm luôn cả Feedback của AI nếu có
function handleDownloadDoc(studentName: string, content: string, feedback?: any) {
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #1e293b; } .feedback-box { background: #f0fdfa; border: 1px solid #ccfbf1; padding: 15px; border-radius: 8px; margin-top: 20px; } .correction { background: #fff; border: 1px solid #e2e8f0; padding: 10px; margin-bottom: 10px; border-radius: 4px; } .wrong { color: #ef4444; text-decoration: line-through; } .right { color: #10b981; font-weight: bold; } .reason { color: #64748b; font-size: 0.9em; }</style></head><body>";
  const footer = "</body></html>";

  let sourceHTML = `<h2 style="text-align:center; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Bài làm của ${studentName}</h2>`;
  sourceHTML += `<p style="white-space: pre-wrap; font-size: 11pt;">${content}</p>`;

  if (feedback) {
    sourceHTML += `<div class="feedback-box">`;
    sourceHTML += `<h3 style="color: #0d9488; margin-top: 0;">Kết quả chấm AI - Overall Band: ${feedback.overall_band}</h3>`;
    sourceHTML += `<p><strong>Nhận xét tổng quan:</strong> ${feedback.examiner_summary}</p>`;

    if (feedback.corrections && feedback.corrections.length > 0) {
      sourceHTML += `<h4 style="color: #0f172a;">Chi tiết sửa lỗi:</h4>`;
      feedback.corrections.forEach((c: any) => {
        sourceHTML += `<div class="correction">`;
        sourceHTML += `<div class="wrong">❌ ${c.original}</div>`;
        sourceHTML += `<div class="right">✅ ${c.corrected}</div>`;
        sourceHTML += `<div class="reason">💡 Lời khuyên: ${c.explanation}</div>`;
        sourceHTML += `</div>`;
      });
    }
    sourceHTML += `</div>`;
  }

  const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(header + sourceHTML + footer);
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
  const [showExportToast, setShowExportToast] = useState(false); // State cho Toast Export Text

  const router = useRouter();

  // Hàm xử lý Export chỉ Text
  const handleExportRawText = (studentName: string, content: string) => {
    if (!content) return;

    // 1. Tạo cấu trúc HTML cho MS Word hiểu được
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
    const footer = "</body></html>";
    
    // Sử dụng white-space: pre-wrap để giữ nguyên xuống dòng của bài làm
    const fullHtml = `${header}<p style="white-space: pre-wrap; font-family: 'Times New Roman'; font-size: 12pt;">${content}</p>${footer}`;

    // 2. Chuyển Blob type thành application/msword
    const blob = new Blob([fullHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    // 3. Đổi đuôi file thành .doc
    link.download = `${studentName.replace(/\s+/g, "_")}.doc`; 
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Hiển thị Toast thông báo
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
};

  // Hàm đăng xuất
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login"); // Chuyển về trang login
  };

  // Logic Auto Sign Out sau 30 phút (1,800,000 ms)
  useEffect(() => {
    if (!isAuthed) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleSignOut();
        alert("Phiên làm việc đã hết hạn sau 30 phút không hoạt động.");
      }, 1000 * 60 * 30); // 30 phút
    };

    // Lắng nghe các hành động của người dùng
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);

    // Khởi tạo bộ đếm lần đầu
    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

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
    if (!window.confirm("Cảnh báo: Hành động này sẽ xóa vĩnh viễn đề thi và TẤT CẢ bài nộp liên quan. Bạn có chắc chắn?")) return;
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
    if (!window.confirm(`Xóa vĩnh viễn bài làm của học viên "${submission.student_name}"?`)) return;
    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.from("submissions").delete().eq("id", submission.id);

    setIsDeleting(false);
    if (deleteError) return setError(deleteError.message);

    if (selectedId === submission.id) setSelectedId(null);
    void loadSubmissions();
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="bg-slate-900/50 p-10 rounded-3xl border border-slate-800 max-w-lg w-full backdrop-blur-xl">
          <div className="mx-auto bg-cyan-950/50 w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-cyan-900">
            <Users className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3 tracking-tight">Khu vực dành cho Giáo viên</h1>
          <p className="text-slate-400 mb-8 leading-relaxed text-sm">
            Học sinh không cần tài khoản để thi. Trang này chỉ dành cho giáo viên — vui lòng đăng nhập để tạo đề và theo dõi bài làm.
          </p>
          <a href="/login?next=/teacher" className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            Đăng nhập ngay <ChevronRight className="h-5 w-5" />
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 text-slate-950 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pb-24 pt-8 px-6 text-white border-b border-slate-800">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                  <Bot className="h-6 w-6 text-cyan-400" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Teacher Workspace</h1>
              </div>
              <p className="text-slate-400 text-sm">Quản lý đề thi và theo dõi tiến độ làm bài của học viên theo thời gian thực.</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors bg-red-950/30 border border-red-900/50 rounded-xl"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>

            {/* Tabs */}
            <div className="flex gap-2 rounded-xl bg-slate-900/80 p-1.5 border border-slate-700/50 backdrop-blur-md w-fit">
              <button
                onClick={() => setActiveTab("submissions")}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === "submissions" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <Radio className={`h-4 w-4 ${activeTab === "submissions" ? "animate-pulse" : ""}`} />
                Theo dõi & Chấm bài
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === "tests" ? "bg-white text-slate-900 shadow-md" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <BookOpen className="h-4 w-4" />
                Quản lý đề thi
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 -mt-16 relative z-10 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-900 rounded-2xl border border-red-200 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {activeTab === "submissions" && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
            {/* Sidebar Danh sách */}
            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200/60 sticky top-6 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Bài làm <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{submissions.length}</span>
                </h2>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                {submissions.length === 0 && (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Chưa có học sinh nào nộp bài</p>
                  </div>
                )}
                {submissions.map((submission) => (
                  <button
                    key={submission.id}
                    onClick={() => setSelectedId(submission.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group ${selectedSubmission?.id === submission.id
                        ? "border-cyan-400 bg-cyan-50/50 ring-4 ring-cyan-50"
                        : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-sm"
                      }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{submission.student_name}</span>
                      {submission.status === "in_progress" && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 font-medium mb-3">{submission.tests?.title ?? "Đề đã bị xóa"}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusStyles[submission.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {statusLabels[submission.status] || submission.status}
                      </span>
                      {submission.warning_count > 0 && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> {submission.warning_count}/5
                        </span>
                      )}
                      {submission.band_score != null && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white border border-slate-900 shadow-sm flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-cyan-400" /> Band {submission.band_score}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chi tiết Bài làm */}
            <div className="rounded-3xl bg-white shadow-sm border border-slate-200/60 overflow-hidden">
              {!selectedSubmission ? (
                <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-slate-50/50">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <FileCheck2 className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa chọn bài làm</h3>
                  <p className="text-sm text-slate-500 max-w-sm">Vui lòng chọn một bài làm từ danh sách bên trái để xem chi tiết hoặc thực hiện chấm điểm.</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Submission Header */}
                  <div className="p-6 border-b border-slate-100 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedSubmission.student_name}</h2>
                        <p className="text-sm font-medium text-cyan-700 mt-1">{selectedSubmission.tests?.title}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusStyles[selectedSubmission.status] || "bg-slate-50 border-slate-200 text-slate-600"}`}>
                        {statusLabels[selectedSubmission.status] || selectedSubmission.status}
                      </span>
                    </div>

                    {selectedSubmission.warning_count > 0 && (
                      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-4 text-sm font-semibold text-amber-900">
                        <div className="bg-amber-100 p-2 rounded-full text-amber-600"><ShieldAlert className="h-5 w-5" /></div>
                        Học sinh đã vi phạm quy chế thoát trang {selectedSubmission.warning_count}/5 lần!
                      </div>
                    )}
                  </div>

                  {/* Submission Body */}
                  <div className="p-6 space-y-8 bg-slate-50/30">
                    <div>
                      <div className="flex items-center justify-between mb-4 border-b border-slate-200/80 pb-3">
                        {/* Cấu trúc Flexbox: Tiêu đề + Nút Export nằm cạnh nhau */}
                        <div className="flex items-center gap-2">
                          <label className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                            <FileCheck2 className="h-5 w-5 text-slate-500" /> Nội dung bài làm
                          </label>

                          {/* Nút Export (Chỉ hiển thị khi có nội dung) */}
                          {selectedSubmission.content && (
                            <div className="relative flex items-center">
                              <button
                                onClick={() => handleExportRawText(selectedSubmission.student_name, selectedSubmission.content ?? "")}
                                className="group p-1.5 rounded-lg text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 hover:shadow-sm border border-transparent hover:border-cyan-200 transition-all"
                                title="Xuất bài làm (Chỉ văn bản)"
                              >
                                <Download className="h-4 w-4" />
                              </button>

                              {/* Toast Notification (Mini tooltip hiện khi xuất thành công) */}
                              {showExportToast && (
                                <span className="absolute left-full ml-2 whitespace-nowrap bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded shadow-sm animate-in fade-in slide-in-from-left-2 z-10">
                                  Đã xuất file!
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {selectedSubmission.status === "in_progress" && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            <Radio className="h-3.5 w-3.5 animate-pulse" /> Đang Live...
                          </span>
                        )}
                      </div>

                      {/* Giao diện Đọc bài được nâng cấp */}
                      <div className="whitespace-pre-wrap font-serif text-[16px] leading-[2.2] bg-[#fcfcfc] border border-slate-300 rounded-xl px-8 py-8 shadow-inner min-h-[300px] text-slate-800 tracking-wide selection:bg-cyan-200">
                        {selectedSubmission.content?.trim() || <span className="text-slate-400 italic font-sans text-sm">Học sinh chưa nhập nội dung nào...</span>}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-200">
                      <button
                        onClick={() => handleGrade(selectedSubmission)}
                        disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none"
                      >
                        {isGrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 text-cyan-400" />}
                        {selectedSubmission.feedback ? "Yêu cầu AI chấm lại" : "Chấm bài bằng AI"}
                      </button>

                      <button
                        onClick={() =>
                          handleDownloadDoc(selectedSubmission.student_name, selectedSubmission.content ?? "", selectedSubmission.feedback)
                        }
                        disabled={!selectedSubmission.content}
                        className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-50"
                      >
                        <FileDown className="h-4 w-4" /> Xuất File DOC
                      </button>

                      <button
                        onClick={() => handleDeleteSubmission(selectedSubmission)}
                        disabled={isDeleting}
                        className="ml-auto flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> Xóa bài
                      </button>

                      {selectedSubmission.status === "in_progress" && (
                        <div className="w-full mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/50 p-3 rounded-xl border border-slate-200 border-dashed">
                          <Clock className="h-4 w-4" /> Hệ thống đang chờ học sinh ấn nút nộp bài để có thể chấm điểm.
                        </div>
                      )}
                    </div>

                    {/* AI Feedback UI Premium */}
                    {selectedSubmission.feedback && (
                      <div className="mt-8 rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/80 to-white overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-cyan-100 bg-white/50 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-cyan-100 p-2.5 rounded-2xl">
                              <Sparkles className="h-6 w-6 text-cyan-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-900 tracking-tight">Đánh giá từ AI Examiner</h3>
                              <p className="text-xs font-medium text-cyan-700">Tự động phân tích theo tiêu chuẩn IELTS</p>
                            </div>
                          </div>
                          <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl flex items-center gap-2 shadow-md">
                            <span className="text-sm font-medium text-slate-300">Overall</span>
                            <span className="text-2xl font-black text-cyan-400">{selectedSubmission.feedback.overall_band}</span>
                          </div>
                        </div>

                        <div className="p-6 space-y-8">
                          <div className="bg-white rounded-2xl p-5 border border-cyan-100/50 shadow-sm relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 rounded-l-2xl"></div>
                            <p className="text-[15px] leading-relaxed text-slate-700 italic">
                              "{selectedSubmission.feedback.examiner_summary}"
                            </p>
                          </div>

                          <div className="grid gap-5 sm:grid-cols-2">
                            {/* Task 1 Card */}
                            {selectedSubmission.feedback.task1 && (
                              <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden hover:border-cyan-300 transition-colors">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                  <span className="font-bold text-slate-800 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 text-slate-400" /> Task 1
                                  </span>
                                  <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">
                                    Band {selectedSubmission.feedback.task1.band}
                                  </span>
                                </div>
                                <div className="p-5">
                                  <dl className="space-y-3 text-sm">
                                    {[
                                      { label: "Task Achievement", score: selectedSubmission.feedback.task1.TA },
                                      { label: "Coherence & Cohesion", score: selectedSubmission.feedback.task1.CC },
                                      { label: "Lexical Resource", score: selectedSubmission.feedback.task1.LR },
                                      { label: "Grammar", score: selectedSubmission.feedback.task1.GRA }
                                    ].map((item, i) => (
                                      <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                        <dt className="text-slate-500 font-medium">{item.label}</dt>
                                        <dd className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded text-xs">{item.score}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </div>
                            )}

                            {/* Task 2 Card */}
                            {selectedSubmission.feedback.task2 && (
                              <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden hover:border-cyan-300 transition-colors">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                  <span className="font-bold text-slate-800 flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-slate-400" /> Task 2
                                  </span>
                                  <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">
                                    Band {selectedSubmission.feedback.task2.band}
                                  </span>
                                </div>
                                <div className="p-5">
                                  <dl className="space-y-3 text-sm">
                                    {[
                                      { label: "Task Response", score: selectedSubmission.feedback.task2.TR },
                                      { label: "Coherence & Cohesion", score: selectedSubmission.feedback.task2.CC },
                                      { label: "Lexical Resource", score: selectedSubmission.feedback.task2.LR },
                                      { label: "Grammar", score: selectedSubmission.feedback.task2.GRA }
                                    ].map((item, i) => (
                                      <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                        <dt className="text-slate-500 font-medium">{item.label}</dt>
                                        <dd className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded text-xs">{item.score}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Corrections Diff */}
                          {selectedSubmission.feedback.corrections && selectedSubmission.feedback.corrections.length > 0 && (
                            <div className="pt-4">
                              <h4 className="font-black text-slate-900 mb-4 text-lg flex items-center gap-2">
                                Lỗi sai & Đề xuất sửa
                              </h4>
                              <div className="space-y-4">
                                {selectedSubmission.feedback.corrections.map((correction: any, index: number) => (
                                  <div
                                    key={index}
                                    className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm space-y-3"
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="rounded-xl bg-red-50/50 border border-red-100 p-3">
                                        <span className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Bản gốc</span>
                                        <p className="text-[14px] text-red-700 line-through decoration-red-300/50">
                                          {correction.original}
                                        </p>
                                      </div>
                                      <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
                                        <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Đề xuất sửa</span>
                                        <p className="text-[14px] text-emerald-800 font-medium">
                                          {correction.corrected}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                                      <Bot className="h-5 w-5 shrink-0 text-cyan-600 mt-0.5" />
                                      <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                        {correction.explanation}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB TẠO ĐỀ THI */}
        {activeTab === "tests" && (
          <section className="grid gap-6 lg:grid-cols-[1fr_450px] items-start">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/60 sticky top-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Ngân hàng Đề thi</h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">Danh sách các đề IELTS Writing bạn đã tạo</p>
                </div>
                <button
                  onClick={() => setEditingTest({ title: "", task1_prompt: "", task2_prompt: "", image_url: null })}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 shadow-sm transition-all hover:shadow-md"
                >
                  <Plus className="h-4 w-4" /> Soạn đề mới
                </button>
              </div>

              <div className="grid gap-4 max-h-[650px] overflow-y-auto pr-2 custom-scrollbar">
                {tests.map((test) => (
                  <div key={test.id} className="p-5 border border-slate-200 rounded-2xl bg-white hover:border-cyan-300 hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-cyan-400 transition-colors"></div>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-slate-800 group-hover:text-cyan-800 pl-2 pr-4">{test.title}</h3>
                      <div className="flex gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingTest(test)} className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-md transition" title="Sửa đề">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteTest(test.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition" title="Xóa đề">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => copyTestLink(test.id)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-md transition" title="Copy Link">
                          {copiedId === test.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="pl-2 flex items-center gap-4 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {test.duration_minutes} phút</span>
                      <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Full Test (Task 1 & 2)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/60 sticky top-6">
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

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
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
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setEditingTest({ ...editingTest, image_url: null })}
                              className="bg-red-500 text-white rounded-full p-3 hover:bg-red-600 shadow-lg transform hover:scale-105 transition-all"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 hover:border-cyan-300 bg-white border-slate-300 transition-all group">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 group-hover:text-cyan-600 transition-colors">
                            {isUploading ? (
                              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                            ) : (
                              <UploadCloud className="w-8 h-8 mb-2" />
                            )}
                            <p className="text-xs font-bold">{isUploading ? "Đang tải ảnh lên máy chủ..." : "Click hoặc kéo thả ảnh vào đây"}</p>
                          </div>
                          <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} disabled={isUploading} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
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
                    <button type="button" onClick={() => setEditingTest(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTest}
                      className="flex-[2] rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-900 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50"
                    >
                      {isSavingTest ? "Đang lưu..." : "Lưu Đề thi"}
                    </button>
                  </div>

                  {editingTest.id && (
                    <button
                      type="button"
                      onClick={() => copyTestLink(editingTest.id!)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors mt-2"
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
        )}
      </div>

      {/* Thêm chút CSS cho thanh cuộn (Scrollbar) nhìn mượt hơn */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
      `}} />
    </main>
  );
}