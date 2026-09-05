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

  try {
    // Tái sử dụng NGUYÊN VẸN AI Agent đang dùng cho bài thi thật — cùng model
    // chain (Gemini → Groq fallback), cùng prompt chấm điểm chuẩn IELTS, cùng
    // ngân sách thời gian. Không truyền task1ImageUrl: trang luyện tập hiện
    // chỉ nhận đề bài dạng văn bản, không có upload ảnh biểu đồ cho Task 1.
    const raw = (await gradeSubmission(
      essay,
      prompt,
      taskType as PracticeTaskType,
      undefined,
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
