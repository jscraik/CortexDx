/**
 * CortexDx ChatGPT Dashboard Components
 *
 * This module exports the static assets for the dashboard UI.
 * The actual component files are served directly from the server.
 */

export const COMPONENT_FILES = [
  "dashboard.html",
  "styles.css",
  "app.js",
] as const;

export type ComponentFile = (typeof COMPONENT_FILES)[number];
