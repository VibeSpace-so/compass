import { NextRequest, NextResponse } from "next/server";

const PERPLEXITY_API = "https://api.perplexity.ai";

interface PerplexityRequestBody {
  action: "search";
  params: {
    query: string;
    max_results?: number;
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonError("Missing Authorization header", 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonError("Invalid Authorization header", 401);
  }

  try {
    const body = (await req.json()) as PerplexityRequestBody;

    if (body.action !== "search") {
      return jsonError("Invalid action. Only 'search' is supported.");
    }

    const { query, max_results = 5 } = body.params || {};
    if (!query) {
      return jsonError("Missing 'query' parameter.");
    }

    const response = await fetch(`${PERPLEXITY_API}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(max_results, 10),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg =
        (errorData as { detail?: string } | null)?.detail ||
        (errorData as { error?: { message?: string } } | null)?.error?.message ||
        `Perplexity API error (${response.status})`;
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonError(message, 500);
  }
}
