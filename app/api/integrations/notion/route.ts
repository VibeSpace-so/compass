import { NextRequest, NextResponse } from "next/server";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface ProxyRequest {
  action: string;
  params?: Record<string, unknown>;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function notionFetch(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
  return fetch(`${NOTION_API}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

async function handleAction(
  action: string,
  params: Record<string, unknown>,
  token: string
): Promise<NextResponse> {
  switch (action) {
    case "search": {
      const res = await notionFetch("/search", token, {
        method: "POST",
        body: {
          query: params.query ?? "",
          page_size: params.page_size ?? 20,
        },
      });
      const data = await res.json();
      if (!res.ok) return jsonError(data.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "get_page": {
      if (!params.page_id) return jsonError("Missing page_id parameter.");
      const pageId = String(params.page_id);
      const [pageRes, blocksRes] = await Promise.all([
        notionFetch(`/pages/${pageId}`, token),
        notionFetch(`/blocks/${pageId}/children?page_size=100`, token),
      ]);
      const page = await pageRes.json();
      if (!pageRes.ok) return jsonError(page.message ?? pageRes.statusText, pageRes.status);
      const blocks = await blocksRes.json();
      return NextResponse.json({
        success: true,
        data: { page, blocks: blocksRes.ok ? blocks : null },
      });
    }

    case "create_page": {
      if (!params.parent_id) return jsonError("Missing parent_id parameter.");
      const body: Record<string, unknown> = {
        parent: { page_id: String(params.parent_id) },
        properties: {
          title: {
            title: [{ text: { content: String(params.title ?? "Untitled") } }],
          },
        },
      };
      if (params.content) {
        body.children = [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: String(params.content) } }],
            },
          },
        ];
      }
      const res = await notionFetch("/pages", token, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) return jsonError(data.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "update_page": {
      if (!params.page_id) return jsonError("Missing page_id parameter.");
      const pageId = String(params.page_id);
      const children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { type: "text", text: { content: String(params.content ?? "") } },
            ],
          },
        },
      ];
      const res = await notionFetch(`/blocks/${pageId}/children`, token, {
        method: "PATCH",
        body: { children },
      });
      const data = await res.json();
      if (!res.ok) return jsonError(data.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "list_databases": {
      const res = await notionFetch("/search", token, {
        method: "POST",
        body: {
          filter: { value: "database", property: "object" },
          page_size: params.page_size ?? 20,
        },
      });
      const data = await res.json();
      if (!res.ok) return jsonError(data.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "query_database": {
      if (!params.database_id) return jsonError("Missing database_id parameter.");
      const body: Record<string, unknown> = {};
      if (params.filter) body.filter = params.filter;
      const res = await notionFetch(
        `/databases/${String(params.database_id)}/query`,
        token,
        { method: "POST", body }
      );
      const data = await res.json();
      if (!res.ok) return jsonError(data.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    default:
      return jsonError(`Unknown action: ${action}`);
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return jsonError("Missing Authorization header.", 401);

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonError("Empty Authorization token.", 401);

  let body: ProxyRequest;
  try {
    body = (await request.json()) as ProxyRequest;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  if (!body.action) return jsonError("Missing action field.");

  try {
    return await handleAction(body.action, body.params ?? {}, token);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(`Proxy error: ${message}`, 502);
  }
}
