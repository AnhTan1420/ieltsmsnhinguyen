// Điểm vào công khai của module chấm điểm — giữ nguyên đường dẫn import
// "@/lib/grading" cho phần còn lại của app (vd. src/app/api/grade/route.ts)
// sau khi tách file gốc grading.ts thành prompt.ts / parse.ts / provider.ts.
export { gradeSubmission } from "./provider";
export type { TaskType } from "./prompt";
export {
  buildSingleTaskFeedback,
  computeTaskBand,
  roundIeltsBand,
  filterTrivialCorrections,
} from "./normalize";
