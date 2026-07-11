"use client";

import { Document, Page, PDFDownloadLink, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GradingFeedback, SubmissionRow } from "@/lib/types";

// ==========================================
// CẤU HÌNH & GIAO DIỆN CHO FILE PDF
// ==========================================
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, color: "#0f172a", lineHeight: 1.5 },
  title: { fontSize: 24, marginBottom: 6, fontWeight: 700 },
  subtitle: { fontSize: 12, marginBottom: 18, color: "#475569" },
  section: { marginTop: 16, paddingTop: 10, borderTop: "1px solid #cbd5e1" },
  heading: { fontSize: 15, marginBottom: 8, fontWeight: 700 },
  band: { fontSize: 18, marginVertical: 10, color: "#0369a1", fontWeight: 700 },
  item: { marginBottom: 8 },
  label: { fontWeight: 700 },
});

function FeedbackDocument({ submission, feedback }: { submission: SubmissionRow; feedback: GradingFeedback }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>IELTS Writing Feedback</Text>
        <Text style={styles.subtitle}>Submission ID: {submission.id}</Text>
        <Text style={styles.band}>Estimated Band Score: {feedback.band_score}</Text>
        <Text>{feedback.examiner_summary}</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Criteria Feedback</Text>
          <Text><Text style={styles.label}>Task Response: </Text>{feedback.criteria_feedback.task_response}</Text>
          <Text><Text style={styles.label}>Coherence and Cohesion: </Text>{feedback.criteria_feedback.coherence_and_cohesion}</Text>
          <Text><Text style={styles.label}>Lexical Resource: </Text>{feedback.criteria_feedback.lexical_resource}</Text>
          <Text><Text style={styles.label}>Grammar: </Text>{feedback.criteria_feedback.grammatical_range_and_accuracy}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Grammar and Spelling Corrections</Text>
          {feedback.mistakes.map((mistake, index) => (
            <View key={`${mistake.original}-${index}`} style={styles.item}>
              <Text><Text style={styles.label}>Original: </Text>{mistake.original}</Text>
              <Text><Text style={styles.label}>Corrected: </Text>{mistake.correction}</Text>
              <Text><Text style={styles.label}>Explanation: </Text>{mistake.explanation}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>High-Band Vocabulary Used</Text>
          {feedback.notable_vocabulary.map((vocab, index) => (
            <Text key={`${vocab.word}-${index}`} style={styles.item}>
              <Text style={styles.label}>{vocab.word}: </Text>{vocab.meaning} Context: {vocab.context}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

// ==========================================
// COMPONENT XUẤT FILE CHÍNH
// ==========================================
export default function FeedbackExport({ submission }: { submission: SubmissionRow }) {
  if (!submission.feedback) {
    return null;
  }

  // Hàm xử lý tạo và tải file .doc
  const handleExportDoc = () => {
    const feedback = submission.feedback!;
    
    // Dựng khung nội dung HTML (Word sẽ render HTML này dưới dạng Document)
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>IELTS Feedback</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h1 style="font-size: 24px; margin-bottom: 6px;">IELTS Writing Feedback</h1>
        <p style="font-size: 12px; color: #475569; margin-bottom: 18px;">Submission ID: ${submission.id}</p>
        <h2 style="font-size: 18px; color: #0369a1; margin-bottom: 10px;">Estimated Band Score: ${feedback.band_score}</h2>
        <p>${feedback.examiner_summary}</p>

        <hr style="margin-top: 16px; border: 0; border-top: 1px solid #cbd5e1;" />
        <h3 style="font-size: 15px; margin-bottom: 8px;">Criteria Feedback</h3>
        <p><strong>Task Response:</strong> ${feedback.criteria_feedback.task_response}</p>
        <p><strong>Coherence and Cohesion:</strong> ${feedback.criteria_feedback.coherence_and_cohesion}</p>
        <p><strong>Lexical Resource:</strong> ${feedback.criteria_feedback.lexical_resource}</p>
        <p><strong>Grammar:</strong> ${feedback.criteria_feedback.grammatical_range_and_accuracy}</p>

        <hr style="margin-top: 16px; border: 0; border-top: 1px solid #cbd5e1;" />
        <h3 style="font-size: 15px; margin-bottom: 8px;">Grammar and Spelling Corrections</h3>
        ${feedback.mistakes.map(m => `
          <div style="margin-bottom: 8px;">
            <p style="margin: 0;"><strong>Original:</strong> ${m.original}</p>
            <p style="margin: 0;"><strong>Corrected:</strong> ${m.correction}</p>
            <p style="margin: 0;"><strong>Explanation:</strong> ${m.explanation}</p>
          </div>
        `).join('')}

        <hr style="margin-top: 16px; border: 0; border-top: 1px solid #cbd5e1;" />
        <h3 style="font-size: 15px; margin-bottom: 8px;">High-Band Vocabulary Used</h3>
        <ul>
          ${feedback.notable_vocabulary.map(v => `
            <li style="margin-bottom: 8px;"><strong>${v.word}:</strong> ${v.meaning} <br/><em>Context:</em> ${v.context}</li>
          `).join('')}
        </ul>
      </body>
      </html>
    `;

    // Tạo Blob (Gói dữ liệu) với MIME type của Word
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    
    // Tạo thẻ <a> ẩn để tự động click tải về
    const link = document.createElement('a');
    link.href = url;
    link.download = `ielts-feedback-${submission.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Dọn dẹp bộ nhớ
  };

  return (
    <div className="flex gap-2">
      {/* Nút xuất PDF cũ */}
      <PDFDownloadLink
        document={<FeedbackDocument submission={submission} feedback={submission.feedback} />}
        fileName={`ielts-feedback-${submission.id}.pdf`}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
      >
        {({ loading }) => (loading ? "Preparing PDF..." : "Export PDF")}
      </PDFDownloadLink>

      {/* Nút xuất DOC mới */}
      <button
        onClick={handleExportDoc}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
      >
        Export DOC
      </button>
    </div>
  );
}