"use client";

import { Document, Page, PDFDownloadLink, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GradingFeedback, SubmissionRow } from "@/lib/types";

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

export default function FeedbackExport({ submission }: { submission: SubmissionRow }) {
  if (!submission.feedback) {
    return null;
  }

  return (
    <PDFDownloadLink
      document={<FeedbackDocument submission={submission} feedback={submission.feedback} />}
      fileName={`ielts-feedback-${submission.id}.pdf`}
      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
    >
      {({ loading }) => (loading ? "Preparing PDF..." : "Export PDF")}
    </PDFDownloadLink>
  );
}
