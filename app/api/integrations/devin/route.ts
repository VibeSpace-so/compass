import { NextRequest, NextResponse } from "next/server";

const DEVIN_API = "https://api.devin.ai/v1";

interface DevinRequestBody {
  action: string;
  params: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  let body: DevinRequestBody;
  try {
    body = (await req.json()) as DevinRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, params } = body;
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  try {
    switch (action) {
      case "create_session":
        return await proxyPost(authHeader, "/sessions", {
          prompt: params.prompt as string,
          ...(params.repos ? { repos: params.repos } : {}),
        });

      case "get_session":
        return await proxyGet(
          authHeader,
          `/sessions/${params.session_id as string}`,
        );

      case "send_message":
        return await proxyPost(
          authHeader,
          `/sessions/${params.session_id as string}/messages`,
          { message: params.message as string },
        );

      case "list_sessions":
        return await proxyGet(authHeader, "/sessions");

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Devin API error: ${msg}` },
      { status: 502 },
    );
  }
}

async function proxyGet(auth: string, path: string): Promise<NextResponse> {
  const res = await fetch(`${DEVIN_API}${path}`, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });

  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}

async function proxyPost(
  auth: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const res = await fetch(`${DEVIN_API}${path}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
