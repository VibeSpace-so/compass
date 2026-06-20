import { NextRequest, NextResponse } from "next/server";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1/documents";

interface ProxyRequest {
  action: string;
  params?: Record<string, unknown>;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function googleFetch(
  url: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  return fetch(url, {
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
    case "list_docs": {
      const q = "mimeType='application/vnd.google-apps.document'";
      const urlParams = new URLSearchParams({
        q,
        fields: "files(id,name,modifiedTime,webViewLink)",
        pageSize: "20",
        orderBy: "modifiedTime desc",
      });
      const res = await googleFetch(`${DRIVE_API}/files?${urlParams}`, token);
      const data = await res.json();
      if (!res.ok) return jsonError(data.error?.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "get_doc": {
      if (!params.doc_id) return jsonError("Missing doc_id parameter.");
      const res = await googleFetch(`${DOCS_API}/${String(params.doc_id)}`, token);
      const data = await res.json();
      if (!res.ok) return jsonError(data.error?.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "create_doc": {
      const title = String(params.title ?? "Untitled");
      const createRes = await googleFetch(DOCS_API, token, {
        method: "POST",
        body: { title },
      });
      const doc = await createRes.json();
      if (!createRes.ok)
        return jsonError(doc.error?.message ?? createRes.statusText, createRes.status);

      if (params.content) {
        const updateRes = await googleFetch(
          `${DOCS_API}/${doc.documentId}:batchUpdate`,
          token,
          {
            method: "POST",
            body: {
              requests: [
                {
                  insertText: {
                    location: { index: 1 },
                    text: String(params.content),
                  },
                },
              ],
            },
          }
        );
        if (!updateRes.ok) {
          const err = await updateRes.json();
          return jsonError(
            `Doc created but content insert failed: ${err.error?.message ?? updateRes.statusText}`,
            updateRes.status
          );
        }
      }
      return NextResponse.json({ success: true, data: doc });
    }

    case "update_doc": {
      if (!params.doc_id) return jsonError("Missing doc_id parameter.");
      const docId = String(params.doc_id);

      const getRes = await googleFetch(`${DOCS_API}/${docId}`, token);
      const existing = await getRes.json();
      if (!getRes.ok)
        return jsonError(existing.error?.message ?? getRes.statusText, getRes.status);

      const endIndex =
        (existing.body?.content as { endIndex?: number }[] | undefined)
          ?.at(-1)?.endIndex ?? 1;
      const insertAt = Math.max(endIndex - 1, 1);

      const res = await googleFetch(`${DOCS_API}/${docId}:batchUpdate`, token, {
        method: "POST",
        body: {
          requests: [
            {
              insertText: {
                location: { index: insertAt },
                text: String(params.content ?? ""),
              },
            },
          ],
        },
      });
      const data = await res.json();
      if (!res.ok) return jsonError(data.error?.message ?? res.statusText, res.status);
      return NextResponse.json({ success: true, data });
    }

    case "search": {
      if (!params.query) return jsonError("Missing query parameter.");
      const q = `mimeType='application/vnd.google-apps.document' and fullText contains '${String(params.query).replace(/'/g, "\\'")}'`;
      const urlParams = new URLSearchParams({
        q,
        fields: "files(id,name,modifiedTime,webViewLink)",
        pageSize: "20",
        orderBy: "modifiedTime desc",
      });
      const res = await googleFetch(`${DRIVE_API}/files?${urlParams}`, token);
      const data = await res.json();
      if (!res.ok) return jsonError(data.error?.message ?? res.statusText, res.status);
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
