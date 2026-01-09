import type { IncomingMessage, ServerResponse } from "node:http";
import { AutoHealer } from "../healing/auto-healer.js";
import { MonitoringScheduler } from "../healing/scheduler.js";
import { TemplateEngine } from "../template-engine/engine.js";
import {
  getTemplate,
  getTemplatesByArea,
  getTemplatesBySeverity,
} from "../templates/fix-templates.js";

type Json = Record<string, unknown>;

function json(res: ServerResponse, status: number, payload: Json): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function parseBody(req: IncomingMessage): Promise<Json | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

export async function handleSelfHealingAPI(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
): Promise<void> {
  const path = url.split("?")[0];

  try {
    if (req.method === "GET" && path === "/api/v1/health") {
      const healer = new AutoHealer({} as never);
      const health = await healer.quickHealthCheck();
      return json(res, 200, {
        success: true,
        health,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === "POST" && path === "/api/v1/self-diagnose") {
      const body = (await parseBody(req)) ?? {};
      const healer = new AutoHealer({} as never);
      const report = await healer.healSelf({
        autoFix: Boolean(body.autoFix),
        dryRun: Boolean(body.dryRun),
        severityThreshold: (body.severity as string) ?? "major",
      });
      return json(res, 200, {
        success: true,
        report,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === "GET" && path === "/api/v1/templates") {
      const query = new URL(url, "http://localhost").searchParams;
      const area = query.get("area") ?? undefined;
      const severity = query.get("severity") ?? undefined;
      const templates = area
        ? getTemplatesByArea(area)
        : severity
          ? getTemplatesBySeverity(severity)
          : (getTemplatesByArea("") ?? []);
      return json(res, 200, {
        success: true,
        templates,
        count: templates.length,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === "POST" && path.startsWith("/api/v1/templates/")) {
      const templateId = path.replace("/api/v1/templates/", "").trim();
      if (!templateId) {
        return json(res, 404, {
          success: false,
          error: "Template ID required",
          timestamp: new Date().toISOString(),
        });
      }
      const template = getTemplate(templateId);
      if (!template || (template.id && template.id !== templateId)) {
        return json(res, 404, {
          success: false,
          error: `Template ${templateId} not found`,
          timestamp: new Date().toISOString(),
        });
      }
      const body = (await parseBody(req)) ?? {};
      try {
        const engine = new TemplateEngine();
        const result = await engine.applyTemplate(templateId, {
          dryRun: Boolean(body.dryRun),
          backup: Boolean(body.backup),
          validate: Boolean(body.validate),
        });
        return json(res, 200, {
          success: true,
          result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return json(res, 500, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (req.method === "POST" && path === "/api/v1/monitor") {
      const body = (await parseBody(req)) ?? {};
      const action = (body.action as string) ?? "status";
      const scheduler = new MonitoringScheduler({ intervalSeconds: 300 });
      try {
        if (action === "start") {
          scheduler.start();
          return json(res, 200, {
            success: true,
            message: "Monitoring started",
            status: scheduler.getStatus(),
            timestamp: new Date().toISOString(),
          });
        }
        if (action === "stop") {
          scheduler.stop();
          return json(res, 200, {
            success: true,
            message: "Monitoring stopped",
            timestamp: new Date().toISOString(),
          });
        }
        if (action === "status") {
          return json(res, 200, {
            success: true,
            status: scheduler.getStatus(),
            jobs: scheduler.getJobs?.() ?? [],
            timestamp: new Date().toISOString(),
          });
        }
        return json(res, 400, {
          success: false,
          error: "Invalid action",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return json(res, 500, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    }

    return json(res, 404, {
      success: false,
      error: "API endpoint not found",
      path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return json(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }
}
