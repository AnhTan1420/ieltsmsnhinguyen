import { NextResponse } from "next/server";
import { gradeSubmission, buildSingleTaskFeedback } from "@/lib/grading";
import { DEFAULT_BUDGET_MS } from "@/lib/grading/provider";

// ─────────────────────────────────────────────────────────────
// ROUTE PUBLIC — /practice (trang luyện tập tự do, không cần đăng nhập).
//
// CỐ TÌNH không import requireAuth() (khác hẳn /api/grade — route chấm bài
// thi thật, bắt buộc token giáo viên hợp lệ): đây là yêu cầu nghiệp vụ, ai
// cũng phải gọi được route này để luyện tập mà không cần tài khoản.
//
// Vì KHÔNG có auth, và route này gọi thẳng ra Gemini/Groq (tốn phí theo
// token) nên có 2 lớp phòng-vệ tối thiểu ở dưới:
//   1. Giới hạn độ dài prompt/essay — chặn request cố tình gửi payload siêu
//      to để "bơm" chi phí AI hoặc chọc timeout.
//   2. Rate limit thô theo IP (xem RATE_LIMIT bên dưới) — CHỈ mang tính giảm
//      thiểu spam vặt, không phải cơ chế bảo mật thật sự (xem giải thích tại
//      chỗ khai báo `hitsByIp`). Nếu traffic thật lớn, nên thay bằng rate
//      limit tầng edge/CDN (Vercel Firewall, Upstash Ratelimit...) thay vì
//      dựa vào bộ nhớ trong tiến trình như ở đây.
//
// KHÔNG ghi Supabase: bài luyện tập không gắn với học sinh/lớp/đề thi thật
// nào trong DB, nên không có "submissionId" hợp lệ để UPDATE như /api/grade.
// Đây cũng là lựa chọn an toàn hơn — route public không nên có quyền ghi
// thẳng vào bảng `submissions` (vốn đang dùng service-role key) mà không qua
// bất kỳ input nào được xác thực trước.
//
// ẢNH BIỂU ĐỒ TASK 1 (task1ImageUrl, thêm sau bản đầu): vì route này KHÔNG
// auth và người luyện tập không có tài khoản, ta KHÔNG dùng Supabase Storage
// (bucket "test-images" chỉ cho phép giáo viên đã đăng nhập upload) — thay
// vào đó FE tự đọc file ảnh thành base64 "data:" URL ngay trên trình duyệt
// (xem ChartImageDropzone + PracticeWriting.tsx) và gửi thẳng chuỗi đó lên
// đây. gradeSubmission() ở dưới gọi fetch(task1ImageUrl) để lấy inline data
// cho Gemini — fetch() của Node/undici đọc được cả "data:" URL lẫn URL http(s)
// thật, nên không cần đổi gì ở tầng provider.ts. Giới hạn độ dài chuỗi bên
// dưới (MAX_IMAGE_DATA_URL_LENGTH) để chặn payload ảnh khổng lồ làm tốn phí
// AI/băng thông một cách vô lý trên route public không auth này.
// ─────────────────────────────────────────────────────────────

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Sanity check giống hệt /api/grade/route.ts (xem comment gốc ở đó) — lặp lại
// ở đây vì `maxDuration` bắt buộc là literal riêng của TỪNG route file, Next.js
// không cho import/tính toán động giá trị này.
const SAFETY_MARGIN_MS = 5_000;
if (DEFAULT_BUDGET_MS > maxDuration * 1000 - SAFETY_MARGIN_MS) {
  console.warn(
    `⚠️ [route/practice-grade] DEFAULT_BUDGET_MS (${DEFAULT_BUDGET_MS}ms) quá sát hoặc vượt maxDuration ` +
      `(${maxDuration}s = ${maxDuration * 1000}ms). Xem comment ở đầu provider.ts.`,
  );
}

const VALID_TASK_TYPES = ["task1", "task2"] as const;
type PracticeTaskType = (typeof VALID_TASK_TYPES)[number];

// Đủ rộng cho một bài Task 2 dài (thậm chí gấp 3-4 lần yêu cầu tối thiểu 250
// từ) nhưng vẫn chặn được payload bất thường (vd. dán nguyên 1 cuốn sách).
const MAX_PROMPT_LENGTH = 3_000;
const MAX_ESSAY_LENGTH = 12_000;
const MIN_ESSAY_LENGTH = 20;

// ~5.5MB ảnh gốc sau khi base64 encode (base64 phình ~33%) — đủ rộng cho ảnh
// chụp/export biểu đồ thông thường, vẫn chặn được payload bất thường. Đây
// cũng là base64 DATA URL (đã gồm phần "data:image/...;base64," ở đầu), nên
// giới hạn ký tự thô ở đây, không phải giới hạn dung lượng file nhị phân.
const MAX_IMAGE_DATA_URL_LENGTH = 7_500_000;

// ─────────────────────────────────────────────────────────────
// Rate limit THÔ theo IP, lưu trong bộ nhớ của chính process Node đang chạy.
//
// LƯU Ý QUAN TRỌNG về giới hạn của cách làm này: trên môi trường serverless
// (Vercel), mỗi instance function có thể là một tiến trình riêng biệt và bị
// tái tạo bất kỳ lúc nào (cold start) — Map này KHÔNG được chia sẻ giữa các
// instance, nên một người dùng vẫn có thể "vô tình" vượt giới hạn nếu request
// của họ rơi vào nhiều instance khác nhau. Đây CHỈ là lớp giảm thiểu spam vặt
// (vd. bấm nhầm liên tục nhiều lần trong 1 phiên), KHÔNG PHẢI cơ chế chống
// lạm dụng đáng tin cậy. Nếu cần chặn spam nghiêm túc, nên chuyển sang rate
// limit tầng edge có state dùng chung (Vercel Firewall/Upstash Redis...).
// ─────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 phút
const RATE_LIMIT_MAX_REQUESTS = 8; // tối đa 8 lượt chấm bài / 10 phút / IP
const hitsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentHits = (hitsByIp.get(ip) ?? []).filter((ts) => ts > windowStart);

  if (recentHits.length >= RATE_LIMIT_MAX_REQUESTS) {
    hitsByIp.set(ip, recentHits);
    return true;
  }

  recentHits.push(now);
  hitsByIp.set(ip, recentHits);

  // Dọn Map định kỳ để tránh phình bộ nhớ vô hạn khi có nhiều IP khác nhau
  // ghé qua trong vòng đời của 1 instance function.
  if (hitsByIp.size > 5_000) {
    for (const [key, hits] of hitsByIp) {
      if (hits.every((ts) => ts <= windowStart)) hitsByIp.delete(key);
    }
  }

  return false;
}

function getClientIp(request: Request): string {
  // Vercel/most proxy chain: "x-forwarded-for" có thể chứa nhiều IP nối bởi
  // dấu phẩy (client, proxy1, proxy2...) — IP thật của client luôn là phần tử
  // ĐẦU TIÊN.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Bạn đã gửi quá nhiều bài trong thời gian ngắn. Vui lòng thử lại sau ít phút." },
      { status: 429 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body không hợp lệ." }, { status: 400 });
  }

  const taskType = body?.taskType;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const essay = typeof body?.essay === "string" ? body.essay.trim() : "";
  // Chỉ có ý nghĩa với Task 1 — Task 2 không có ảnh biểu đồ/bản đồ nào để đối
  // chiếu, nên nếu client lỡ gửi kèm khi taskType = "task2" thì bỏ qua ở dưới.
  const rawTask1ImageUrl = typeof body?.task1ImageUrl === "string" ? body.task1ImageUrl.trim() : "";

  if (!VALID_TASK_TYPES.includes(taskType)) {
    return NextResponse.json({ error: "taskType phải là 'task1' hoặc 'task2'." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "Vui lòng nhập đề bài (prompt)." }, { status: 400 });
  }
  if (!essay) {
    return NextResponse.json({ error: "Vui lòng nhập bài làm." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Đề bài quá dài (tối đa ${MAX_PROMPT_LENGTH} ký tự).` },
      { status: 400 },
    );
  }
  if (essay.length > MAX_ESSAY_LENGTH) {
    return NextResponse.json(
      { error: `Bài làm quá dài (tối đa ${MAX_ESSAY_LENGTH} ký tự).` },
      { status: 400 },
    );
  }
  if (essay.length < MIN_ESSAY_LENGTH) {
    return NextResponse.json(
      { error: "Bài làm quá ngắn để chấm điểm, vui lòng viết đầy đủ hơn." },
      { status: 400 },
    );
  }

  // Chỉ chấp nhận ảnh khi đang chấm Task 1 — validate CHẶT vì đây là input
  // do người dùng ẩn danh tự gửi thẳng lên (không đi qua Supabase Storage như
  // /teacher, không có bước server nào kiểm tra loại file trước đó).
  let task1ImageUrl: string | undefined;
  if (rawTask1ImageUrl && taskType === "task1") {
    if (rawTask1ImageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Ảnh biểu đồ quá lớn, vui lòng chọn ảnh nhẹ hơn." }, { status: 400 });
    }
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(rawTask1ImageUrl)) {
      return NextResponse.json(
        { error: "Ảnh biểu đồ không hợp lệ. Vui lòng chọn lại tệp ảnh (PNG, JPG, WEBP)." },
        { status: 400 },
      );
    }
    task1ImageUrl = rawTask1ImageUrl;
  }

  try {
    // Tái sử dụng NGUYÊN VẸN AI Agent đang dùng cho bài thi thật — cùng model
    // chain (Gemini → Groq fallback), cùng prompt chấm điểm chuẩn IELTS, cùng
    // ngân sách thời gian. task1ImageUrl (nếu có, đã validate ở trên) là ảnh
    // biểu đồ/bản đồ Task 1 học sinh tự kéo-thả/chọn trên trang luyện tập —
    // được gửi dưới dạng base64 "data:" URL vì route này không auth nên không
    // upload qua Supabase Storage như /teacher (xem comment đầu file).
    const raw = (await gradeSubmission(
      essay,
      prompt,
      taskType as PracticeTaskType,
      task1ImageUrl,
      DEFAULT_BUDGET_MS,
    )) as any;

    // Dùng đúng logic chuẩn hoá band/corrections với /api/grade (route bài
    // thi thật) — xem src/lib/grading/normalize.ts.
    const feedback = buildSingleTaskFeedback(raw, taskType as PracticeTaskType);

    return NextResponse.json(feedback);
  } catch (error: any) {
    const technicalDetail = error instanceof Error ? error.message : String(error);
    console.error("❌ [practice-grade] GRADING FAILED:", technicalDetail);

    const isAIOverload = /429|rate limit|quota|exceeded|timed out|timeout|aborted|hết ngân sách|quá tải/i.test(
      technicalDetail,
    );

    return NextResponse.json(
      {
        error: isAIOverload
          ? "Hệ thống AI đang quá tải hoặc hết lượt dùng. Vui lòng thử lại sau ít phút."
          : "Đã xảy ra lỗi hệ thống khi chấm bài. Vui lòng thử lại.",
        detail: technicalDetail,
      },
      { status: isAIOverload ? 503 : 502 },
    );
  }
}
