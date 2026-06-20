import { NextRequest, NextResponse } from "next/server";

const VERCEL_API = "https://api.vercel.com";

type VercelAction =
  | "list_projects"
  | "get_project"
  | "list_deployments"
  | "get_deployment"
  | "create_deployment"
  | "list_domains"
  | "get_deployment_logs";

interface VercelRequestBody {
  action: VercelAction;
  params: Record<string, unknown>;
}

function buildVercelRequest(
  action: VercelAction,
  params: Record<string, unknown>,
  token: string,
): { url: string; init: RequestInit } {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  switch (action) {
    case "list_projects": {
      return { url: `${VERCEL_API}/v9/projects`, init: { headers } };
    }

    case "get_project": {
      const projectId = (params.project_id ?? params.name) as string;
      return {
        url: `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}`,
        init: { headers },
      };
    }

    case "list_deployments": {
      const qs = new URLSearchParams();
      if (params.project_id) qs.set("projectId", params.project_id as string);
      if (params.limit) qs.set("limit", String(params.limit));
      const query = qs.toString();
      return {
        url: `${VERCEL_API}/v6/deployments${query ? `?${query}` : ""}`,
        init: { headers },
      };
    }

    case "get_deployment": {
      const deploymentId = params.deployment_id as string;
      return {
        url: `${VERCEL_API}/v13/deployments/${deploymentId}`,
        init: { headers },
      };
    }

    case "create_deployment": {
      const body: Record<string, unknown> = {
        name: params.project_name as string,
        target: "production",
      };
      if (params.git_ref) {
        body.gitSource = {
          ref: params.git_ref as string,
          type: "branch",
        };
      }
      return {
        url: `${VERCEL_API}/v13/deployments`,
        init: {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      };
    }

    case "list_domains": {
      const projectId = params.project_id as string;
      return {
        url: `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains`,
        init: { headers },
      };
    }

    case "get_deployment_logs": {
      const deploymentId = params.deployment_id as string;
      return {
        url: `${VERCEL_API}/v2/deployments/${deploymentId}/events`,
        init: { headers },
      };
    }

    default:
      throw new Error(`Unknown action: ${action as string}`);
  }
}

const VALID_ACTIONS = new Set<VercelAction>([
  "list_projects",
  "get_project",
  "list_deployments",
  "get_deployment",
  "create_deployment",
  "list_domains",
  "get_deployment_logs",
]);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json(
        { error: "Missing Vercel token in Authorization header." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as VercelRequestBody;
    const { action, params } = body;

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}` },
        { status: 400 },
      );
    }

    const { url, init } = buildVercelRequest(action, params ?? {}, token);
    const upstream = await fetch(url, init);
    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data ?? upstream.statusText },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
