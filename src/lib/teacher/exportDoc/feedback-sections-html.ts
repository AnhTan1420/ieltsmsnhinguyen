import type { AdvancedStructure, BandProgression, Correction, EssayUpgrade, VocabularySuggestion } from "@/lib/types";
import { escapeHtml } from "./html-helpers";

export function buildGoldenRuleHtml(goldenRule?: string): string {
  if (!goldenRule) return "";
  return `<div style="border-left:3px solid #fbbf24;background:#fff;border:1px solid #fef3c7;border-radius:8px;padding:9px 11px;margin-bottom:8px;">
    <p style="margin:0 0 3px 0;font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#b45309;">💡 Nguyên tắc vàng</p>
    <p style="margin:0;font-size:10.5pt;line-height:1.5;color:#334155;">${escapeHtml(goldenRule)}</p>
  </div>`;
}

export function buildBandProgressionHtml(bp?: BandProgression): string {
  if (!bp) return "";
  let html = `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;margin-bottom:8px;">
    <p style="margin:0 0 6px 0;font-size:10.5pt;font-weight:bold;color:#0f172a;">🧭 Lộ trình lên band</p>
    <p style="margin:0 0 4px 0;font-size:10pt;line-height:1.5;color:#334155;"><strong>Vì sao đang ở band này:</strong> ${escapeHtml(bp.why_current)}</p>
    <p style="margin:0 0 4px 0;font-size:10pt;line-height:1.5;color:#334155;"><strong>Vì sao chưa thấp hơn:</strong> ${escapeHtml(bp.why_not_lower)}</p>
    <p style="margin:0 0 4px 0;font-size:10pt;line-height:1.5;color:#334155;"><strong>Vì sao chưa cao hơn:</strong> ${escapeHtml(bp.why_not_higher)}</p>`;
  if (bp.roadmap_steps?.length > 0) {
    html += `<p style="margin:6px 0 3px 0;font-size:10pt;font-weight:bold;color:#1e293b;">Việc cần làm tiếp theo:</p><ol style="margin:0;padding-left:18px;">`;
    bp.roadmap_steps.forEach((step) => {
      html += `<li style="font-size:10pt;line-height:1.5;color:#475569;margin-bottom:2px;">${escapeHtml(step)}</li>`;
    });
    html += `</ol>`;
  }
  html += `</div>`;
  return html;
}

export function buildVocabularyHtml(vocab: VocabularySuggestion[]): string {
  if (vocab.length === 0) return "";
  let html = `<p style="font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:0 0 6px 0;">📖 Nâng cấp từ vựng</p>`;
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">`;
  vocab.forEach((v) => {
    html += `<tr>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-size:9.5pt;color:#b91c1c;text-decoration:line-through;">${escapeHtml(v.original_word)}</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-size:9.5pt;font-weight:bold;color:#047857;">${escapeHtml(v.better_alternative)}</td>
      <td style="border:1px solid #e2e8f0;padding:5px 8px;font-size:9.5pt;color:#475569;">${escapeHtml(v.reason)}</td>
    </tr>`;
  });
  html += `</table>`;
  return html;
}

export function buildAdvancedStructuresHtml(structures: AdvancedStructure[]): string {
  if (structures.length === 0) return "";
  let html = `<p style="font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:0 0 6px 0;">🪄 Cấu trúc nâng cao gợi ý</p>`;
  structures.forEach((s) => {
    html += `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
      <p style="margin:0 0 2px 0;font-size:8.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.02em;color:#0e7490;">${escapeHtml(s.structure_name)}</p>`;
    if (s.original_sentence) {
      html += `<p style="margin:0 0 2px 0;font-size:9.5pt;color:#94a3b8;text-decoration:line-through;white-space:pre-wrap;">${escapeHtml(s.original_sentence)}</p>`;
    }
    html += `<p style="margin:0 0 2px 0;font-size:10pt;font-style:italic;color:#1e293b;white-space:pre-wrap;"><span style="background:#d1fae5;padding:0 2px;border-radius:2px;">${escapeHtml(
      s.example_sentence_en,
    )}</span></p>
      <p style="margin:0;font-size:9.5pt;color:#475569;">${escapeHtml(s.explanation_vi)}</p>
    </div>`;
  });
  return html;
}

export function buildEssayUpgradesHtml(upgrades: EssayUpgrade[], legacyEditedEssay?: string): string {
  if (upgrades.length > 0) {
    let html = `<p style="font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:0 0 6px 0;">✨ Câu được viết lại hay hơn</p>`;
    upgrades.forEach((u) => {
      html += `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
        <p style="margin:0 0 2px 0;font-size:9.5pt;color:#94a3b8;text-decoration:line-through;white-space:pre-wrap;">${escapeHtml(u.original)}</p>
        <p style="margin:0 0 2px 0;font-size:10pt;color:#1e293b;white-space:pre-wrap;"><span style="background:#e0f2fe;padding:0 2px;border-radius:2px;">${escapeHtml(
          u.upgraded,
        )}</span></p>
        <p style="margin:0;font-size:9.5pt;color:#475569;">${escapeHtml(u.note)}</p>
      </div>`;
    });
    return html;
  }
  // Fallback cho dữ liệu cũ (chấm trước khi có "essay_upgrades" dạng cấu trúc) —
  // hiện nguyên đoạn văn tự do, giống cách GradingResultPanel.tsx làm ở web.
  if (legacyEditedEssay) {
    return `<p style="font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:0 0 6px 0;">✨ Bài viết mẫu đã chỉnh sửa</p>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;margin-bottom:8px;background:#f0f9ff;">
        <p style="margin:0;font-size:10.5pt;line-height:1.5;white-space:pre-wrap;color:#1e293b;">${escapeHtml(legacyEditedEssay)}</p>
      </div>`;
  }
  return "";
}

export function buildCorrectionsHtml(corrections: Correction[]): string {
  if (corrections.length === 0) return "";
  let html = `<h4 style="font-size:11pt;color:#0f172a;margin:0 0 7px 0;">Lỗi sai &amp; Đề xuất sửa</h4>`;
  corrections.forEach((c) => {
    html += `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:9px;margin-bottom:7px;">
      <p style="margin:0 0 4px 0;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:5px 8px;font-size:10.5pt;color:#b91c1c;text-decoration:line-through;white-space:pre-wrap;">❌ ${escapeHtml(c.original)}</p>
      <p style="margin:0 0 4px 0;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:5px 8px;font-size:10.5pt;font-weight:bold;color:#047857;white-space:pre-wrap;">✅ ${escapeHtml(c.corrected)}</p>
      <p style="margin:0;background:#f8fafc;border-radius:6px;padding:5px 8px;font-size:9.5pt;color:#475569;">💡 <i>Lời khuyên:</i> ${escapeHtml(c.explanation)}</p>
    </div>`;
  });
  return html;
}
