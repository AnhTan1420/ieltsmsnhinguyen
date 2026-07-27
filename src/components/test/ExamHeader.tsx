"use client";

import type { RefObject } from "react";
import { Timer, User } from "lucide-react";
import { scrollToRef } from "@/lib/student-test-utils";
import NavPill from "./NavPill";

type ExamHeaderProps = {
  title: string;
  studentName: string;
  formatted: string;
  isLow: boolean;
  hasTask1: boolean;
  hasTask2: boolean;
  task1Done: boolean;
  task2Done: boolean;
  task1Ref: RefObject<HTMLElement | null>;
  task2Ref: RefObject<HTMLElement | null>;
  submitRef: RefObject<HTMLDivElement | null>;
};

// Thanh trên cùng dính (sticky) trong lúc làm bài: tên đề thi + tên học sinh +
// đồng hồ đếm ngược, cùng hàng nút điều hướng nhanh tới Task 1/Task 2/nộp bài.
export default function ExamHeader({
  title,
  studentName,
  formatted,
  isLow,
  hasTask1,
  hasTask2,
  task1Done,
  task2Done,
  task1Ref,
  task2Ref,
  submitRef,
}: ExamHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0f17]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0b0f17]/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400/80">
            IELTS Writing Test
          </p>
          <h1 className="truncate text-lg font-bold leading-tight text-white">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:flex">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-white">{studentName}</span>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-lg font-bold tabular-nums ${
              isLow
                ? "animate-pulse bg-red-500/15 text-red-300 ring-1 ring-red-500/40"
                : "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20"
            }`}
          >
            <Timer className="h-4 w-4" />
            {formatted}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-6 py-2.5">
          {hasTask1 && <NavPill label="Task 1" done={task1Done} onClick={() => scrollToRef(task1Ref)} />}
          {hasTask2 && <NavPill label="Task 2" done={task2Done} onClick={() => scrollToRef(task2Ref)} />}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => scrollToRef(submitRef)}
            className="shrink-0 whitespace-nowrap rounded-full border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
          >
            Đi tới nộp bài →
          </button>
        </div>
      </div>
    </header>
  );
}
