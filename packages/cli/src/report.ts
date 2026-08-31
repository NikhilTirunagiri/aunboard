import type { Reporter } from "./args";
import type { StepResult, TourResult, VerifyReport } from "./types";

const STATUS_LABEL: Record<StepResult["status"], string> = {
  ok: "OK",
  "not-found": "NOT FOUND",
  ambiguous: "AMBIGUOUS",
  error: "ERROR",
};

export interface RenderContext {
  /** Base URL that was verified — shown in the pretty header. */
  url: string;
}

function stepLine(step: StepResult): string {
  const status = STATUS_LABEL[step.status].padEnd(9);
  const route = step.route ? `  ${step.route}` : "";
  const head = `  ${status} ${step.index + 1}. ${step.label}${route}`;
  if (step.status === "ok") return head;
  return `${head}\n${" ".repeat(13)}${step.reason ?? ""}\n${" ".repeat(13)}candidates found: ${step.candidateCount}`;
}

function tourBlock(tour: TourResult): string {
  const header = `${tour.id} — ${tour.name}  (${tour.file})`;
  if (tour.error) return `${header}\n  ERROR     ${tour.error}`;
  if (tour.steps.length === 0) return `${header}\n  (no steps)`;
  return [header, ...tour.steps.map(stepLine)].join("\n");
}

/** Human-readable output for a terminal. */
export function renderPretty(report: VerifyReport, ctx: RenderContext): string {
  const lines: string[] = [`aunboard verify — ${ctx.url}`, ""];
  if (report.tours.length === 0) {
    lines.push("No tours to verify.", "");
  } else {
    for (const tour of report.tours) {
      lines.push(tourBlock(tour), "");
    }
  }
  const { total, passed, failed } = report.summary;
  lines.push(
    `${report.tours.length} tour${report.tours.length === 1 ? "" : "s"}, ${total} step${total === 1 ? "" : "s"}: ${passed} passed, ${failed} failed`,
  );
  lines.push(report.ok ? "All tour steps resolved." : "Some tour steps no longer resolve.");
  return lines.join("\n");
}

/** Machine-readable output: stable shape, safe to pipe into jq. */
export function renderJson(report: VerifyReport): string {
  return JSON.stringify(
    {
      ok: report.ok,
      tours: report.tours.map((tour) => ({
        id: tour.id,
        name: tour.name,
        file: tour.file,
        ...(tour.error ? { error: tour.error } : {}),
        steps: tour.steps.map((step) => ({
          index: step.index,
          label: step.label,
          route: step.route,
          status: step.status,
          reason: step.reason,
          candidateCount: step.candidateCount,
          expected: step.expected,
        })),
      })),
      summary: report.summary,
    },
    null,
    2,
  );
}

/** GitHub Actions workflow commands, so failures annotate the PR inline. */
export function renderGithub(report: VerifyReport): string {
  const lines: string[] = [];
  for (const tour of report.tours) {
    if (tour.error) {
      lines.push(`::error file=${tour.file}::${escapeData(tour.error)}`);
      continue;
    }
    for (const step of tour.steps) {
      if (step.status === "ok") continue;
      const where = step.route ? ` on route ${step.route}` : "";
      const message = `${STATUS_LABEL[step.status]}: tour "${tour.id}" step ${step.index + 1} ("${step.label}")${where} — ${step.reason ?? ""} [candidates: ${step.candidateCount}]`;
      lines.push(`::error file=${tour.file},title=aunboard tour "${tour.id}" step ${step.index + 1}::${escapeData(message)}`);
    }
  }
  const { total, passed, failed } = report.summary;
  lines.push(
    report.ok
      ? `::notice::aunboard verify: ${passed}/${total} tour steps resolved.`
      : `::error::aunboard verify: ${failed} of ${total} tour steps failed to resolve.`,
  );
  return lines.join("\n");
}

/** Workflow-command data must not contain raw newlines or `%`/`\r`. */
function escapeData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function render(reporter: Reporter, report: VerifyReport, ctx: RenderContext): string {
  switch (reporter) {
    case "json":
      return renderJson(report);
    case "github":
      return renderGithub(report);
    default:
      return renderPretty(report, ctx);
  }
}
