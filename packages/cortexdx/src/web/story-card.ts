import type { Story } from "../story/story-schema";

const formatSummary = (story: Story): string => {
  const timestamp = new Date(story.timestamp).toUTCString();
  const confidence = Math.round(story.confidence * 100);
  return `At ${timestamp}, ${story.trigger.details}. Confidence ${confidence}%.`;
};

const createChip = (doc: Document, label: string, count: number): HTMLElement => {
  const chip = doc.createElement("span");
  chip.className = "story-card__chip";
  chip.textContent = `${label}: ${count}`;
  chip.setAttribute("role", "status");
  chip.setAttribute("aria-label", `${count} ${label.toLowerCase()} references`);
  return chip;
};

export const createStoryCard = (doc: Document, story: Story): HTMLElement => {
  const article = doc.createElement("article");
  article.className = "story-card";
  article.setAttribute("role", "article");
  article.setAttribute("tabindex", "0");
  article.setAttribute("aria-labelledby", `${story.id}-title`);
  article.setAttribute("aria-keyshortcuts", "g G Enter Esc t ?");

  const srSummary = doc.createElement("p");
  srSummary.className = "sr-only";
  srSummary.textContent = formatSummary(story);
  article.appendChild(srSummary);

  const title = doc.createElement("h3");
  title.id = `${story.id}-title`;
  title.textContent = story.symptom.user_visible;
  article.appendChild(title);

  const subtitle = doc.createElement("p");
  subtitle.className = "story-card__subtitle";
  subtitle.textContent = story.symptom.technical;
  article.appendChild(subtitle);

  const confidence = doc.createElement("span");
  const confidencePct = Math.round(story.confidence * 100);
  confidence.className = "story-card__confidence";
  confidence.textContent = `${confidencePct}% confidence`;
  confidence.setAttribute("aria-label", `Confidence ${confidencePct} percent`);
  article.appendChild(confidence);

  const chipRow = doc.createElement("div");
  chipRow.className = "story-card__chips";
  chipRow.appendChild(createChip(doc, "Logs", story.evidence.logs.length));
  chipRow.appendChild(createChip(doc, "Traces", story.evidence.traces.length));
  chipRow.appendChild(createChip(doc, "Metrics", story.evidence.metrics.length));
  article.appendChild(chipRow);

  const actionButton = doc.createElement("button");
  actionButton.type = "button";
  actionButton.className = "story-card__action";
  actionButton.textContent = story.suggested_actions[0]?.label ?? "View action";
  actionButton.dataset.command = story.suggested_actions[0]?.command ?? "";
  actionButton.setAttribute("aria-pressed", "false");
  actionButton.setAttribute("aria-keyshortcuts", "Enter");
  article.appendChild(actionButton);

  return article;
};
