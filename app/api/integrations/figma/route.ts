import { NextRequest, NextResponse } from "next/server";

const FIGMA_API = "https://api.figma.com/v1";

type FigmaAction =
  | "get_file"
  | "get_components"
  | "get_styles"
  | "get_images"
  | "get_comments"
  | "post_comment";

interface FigmaRequestBody {
  action: FigmaAction;
  params: Record<string, unknown>;
}

function buildFigmaRequest(
  action: FigmaAction,
  params: Record<string, unknown>,
  token: string,
): { url: string; init: RequestInit } {
  const headers: Record<string, string> = {
    "X-Figma-Token": token,
  };

  switch (action) {
    case "get_file": {
      const fileKey = params.file_key as string;
      return { url: `${FIGMA_API}/files/${fileKey}`, init: { headers } };
    }

    case "get_components": {
      const fileKey = params.file_key as string;
      return {
        url: `${FIGMA_API}/files/${fileKey}/components`,
        init: { headers },
      };
    }

    case "get_styles": {
      const fileKey = params.file_key as string;
      return {
        url: `${FIGMA_API}/files/${fileKey}/styles`,
        init: { headers },
      };
    }

    case "get_images": {
      const fileKey = params.file_key as string;
      const nodeIds = params.node_ids as string[];
      const format = (params.format as string) ?? "png";
      const scale = (params.scale as number) ?? 1;
      const qs = new URLSearchParams({
        ids: nodeIds.join(","),
        format,
        scale: String(scale),
      });
      return {
        url: `${FIGMA_API}/images/${fileKey}?${qs}`,
        init: { headers },
      };
    }

    case "get_comments": {
      const fileKey = params.file_key as string;
      return { url: `${FIGMA_API}/files/${fileKey}/comments`, init: { headers } };
    }

    case "post_comment": {
      const fileKey = params.file_key as string;
      const body: Record<string, unknown> = {
        message: params.message as string,
      };
      if (params.x !== undefined && params.y !== undefined) {
        body.client_meta = {
          x: params.x as number,
          y: params.y as number,
        };
      }
      return {
        url: `${FIGMA_API}/files/${fileKey}/comments`,
        init: {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      };
    }

    default:
      throw new Error(`Unknown action: ${action as string}`);
  }
}

const VALID_ACTIONS = new Set<FigmaAction>([
  "get_file",
  "get_components",
  "get_styles",
  "get_images",
  "get_comments",
  "post_comment",
]);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json(
        { error: "Missing Figma token in Authorization header." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as FigmaRequestBody;
    const { action, params } = body;

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(", ")}` },
        { status: 400 },
      );
    }

    const { url, init } = buildFigmaRequest(action, params ?? {}, token);
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
