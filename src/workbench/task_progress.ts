/**
 * Multi-step task progress for long-running Workbench loads (#99).
 *
 * The controller owns `TaskProgress` on `getState()`; the Web Shell paints a
 * dimmed overlay from {@link taskProgressInnerHtml}. Step states are
 * waiting → running → finished (or failed).
 */

export type TaskStepState = "waiting" | "running" | "finished" | "failed";

export interface TaskProgressStep {
  id: string;
  label: string;
  state: TaskStepState;
  detail?: string;
}

export interface TaskProgress {
  title: string;
  steps: TaskProgressStep[];
}

export const TASK_PROGRESS_OVERLAY_ID = "task-progress-overlay";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Overlay inner HTML for a live task (title + substeps). */
export function taskProgressInnerHtml(progress: TaskProgress): string {
  const steps = progress.steps.map((step) => {
    const detail = step.detail
      ? `<span class="task-progress-detail">${escapeHtml(step.detail)}</span>`
      : "";
    return (
      `<li class="task-progress-step task-progress-step--${step.state}" data-step-id="${
        escapeHtml(step.id)
      }" data-state="${step.state}">` +
      `<span class="task-progress-marker" aria-hidden="true"></span>` +
      `<span class="task-progress-label">${escapeHtml(step.label)}</span>` +
      detail +
      `</li>`
    );
  }).join("");
  return (
    `<div class="task-progress-card" role="status" aria-live="polite" aria-busy="${
      progress.steps.some((s) => s.state === "running") ? "true" : "false"
    }">` +
    `<div class="task-progress-header">` +
    `<span class="task-progress-spinner" aria-hidden="true"></span>` +
    `<h2 class="task-progress-title">${escapeHtml(progress.title)}</h2>` +
    `</div>` +
    `<ol class="task-progress-steps">${steps}</ol>` +
    `</div>`
  );
}
