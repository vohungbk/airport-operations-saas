import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiAnswerCard } from "@/components/domain/ai-answer-card";
import { KanbanColumn } from "@/components/domain/kanban-column";
import { SuggestedQuestionChip } from "@/components/domain/suggested-question-chip";
import { WorkflowBoardCard, type WorkflowBoardCardProps } from "@/components/domain/workflow-board-card";
import type { AnswerBlock } from "@/lib/assistant/answer";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const card = (over: Partial<WorkflowBoardCardProps> = {}) =>
  html(
    createElement(WorkflowBoardCard, {
      booking_ref: "BK-1042",
      step: { number: 3, total: 5, label: "Assigned" },
      ...over,
    }),
  );

describe("WorkflowBoardCard", () => {
  it("should show the booking and its step", () => {
    const out = card();
    expect(out).toContain("BK-1042");
    expect(out).toContain("Step 3 of 5: Assigned");
  });

  it("should show the booking status as a badge when given", () => {
    expect(card({ status: "assigned" })).toContain('data-status="assigned"');
  });

  it("should mark a delayed flight with an icon and text", () => {
    const out = card({ flight_alert: { kind: "delayed", minutes: 50 } });
    expect(out).toContain("DELAYED 50 MIN");
    expect(out).toContain('data-kind="delayed"');
    expect(out).toContain("<svg");
  });

  it("should mark an early flight", () => {
    expect(card({ flight_alert: { kind: "early", minutes: 45 } })).toContain("EARLY 45 MIN");
  });

  it("should show no flight mark when there is no alert", () => {
    expect(card()).not.toContain('data-slot="board-flight-alert"');
  });

  it.each([
    ["normal", "Normal priority"],
    ["high", "High priority"],
    ["urgent", "Urgent"],
  ] as const)("should word the %s priority in text with an icon", (priority, text) => {
    const out = card({ priority });
    expect(out).toContain(text);
    expect(out).toContain('data-slot="board-priority"');
    expect(out).toContain("<svg");
  });

  it("should say a booking off the path has no step", () => {
    expect(card({ step: null })).toContain("Not on the path");
  });
});

describe("KanbanColumn", () => {
  it("should show the title, the count and the cards", () => {
    const out = html(createElement(KanbanColumn, { title: "Assigned", count: 2 }, createElement("p", null, "CARD-A")));
    expect(out).toContain("Assigned");
    expect(out).toContain('data-slot="kanban-count"');
    expect(out).toContain("CARD-A");
  });

  it("should say the column is empty and not show a count of 0", () => {
    const out = html(createElement(KanbanColumn, { title: "Assigned", count: 0, empty_message: "No bookings in this step." }));
    expect(out).toContain("No bookings in this step.");
    expect(out).toContain('data-empty="true"');
    expect(out).not.toContain('data-slot="kanban-count"');
  });
});

describe("AiAnswerCard", () => {
  const blocks: AnswerBlock[] = [
    { type: "text", text: "Revenue rose this month." },
    { type: "table", columns: ["Airport", "Revenue"], rows: [["SGN", "1,200.00"]] },
    { type: "chart", title: "By airport", bars: [{ label: "SGN", value: 80, value_text: "80" }, { label: "HAN", value: 40, value_text: "40" }] },
    { type: "kpi", items: [{ label: "Revenue", current: 112.5, previous: 100, current_text: "112.50", previous_text: "100.00" }] },
    { type: "recommendations", items: ["Add seats at SGN."] },
  ];
  const answer = (props: object) => html(createElement(AiAnswerCard, { blocks, ...props }));

  it("should show the text, table, chart, KPI and recommendations", () => {
    const out = answer({});
    expect(out).toContain("Revenue rose this month.");
    expect(out).toContain("1,200.00");
    expect(out).toContain('data-slot="ai-answer-chart"');
    expect(out).toContain("112.50");
    expect(out).toContain("Add seats at SGN.");
  });

  it("should show the data period", () => {
    expect(answer({ data_period: "1 Oct to 31 Oct 2026" })).toContain("Data period: 1 Oct to 31 Oct 2026");
  });

  it("should word a KPI rise with an icon, a sign and text", () => {
    const out = answer({});
    expect(out).toContain('data-direction="up"');
    expect(out).toContain("+12.5%");
    expect(out).toContain("(was 100.00)");
  });

  it("should draw the longest bar full and the other in proportion", () => {
    const out = answer({});
    expect(out).toContain("width:100%");
    expect(out).toContain("width:50%");
  });

  it("should say there is no data, not zeros, when every block is empty", () => {
    const out = html(createElement(AiAnswerCard, { blocks: [{ type: "table", columns: ["A"], rows: [] }, { type: "kpi", items: [] }] }));
    expect(out).toContain("No data for this question.");
    expect(out).not.toContain("<table");
    expect(out).not.toContain("0.00");
  });

  it("should say there is no comparison, not Infinity, when the period before was zero", () => {
    const out = html(
      createElement(AiAnswerCard, {
        blocks: [{ type: "kpi", items: [{ label: "Bookings", current: 8, previous: 0, current_text: "8" }] }],
      }),
    );
    expect(out).toContain("No comparison");
    expect(out).not.toContain("Infinity");
    expect(out).not.toContain("NaN");
  });
});

describe("SuggestedQuestionChip", () => {
  const chip = () => html(createElement(SuggestedQuestionChip, { question: "Which airport earned the most last month?" }));

  it("should show the question it is given", () => {
    expect(chip()).toContain("Which airport earned the most last month?");
  });

  it("should wrap a long question and keep a 44 px target on a touch screen", () => {
    const out = chip();
    expect(out).toContain("whitespace-normal");
    expect(out).toContain("pointer-coarse:min-h-11");
  });
});
