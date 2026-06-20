import { NextRequest, NextResponse } from "next/server";

const SLACK_API = "https://slack.com/api";

interface SlackRequestBody {
  action: string;
  params?: Record<string, unknown>;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonError("Missing Authorization header", 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return jsonError("Invalid Authorization header", 401);
  }

  let body: SlackRequestBody;
  try {
    body = (await req.json()) as SlackRequestBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const { action, params } = body;
  if (!action) {
    return jsonError("Missing action field");
  }

  try {
    switch (action) {
      case "list_channels":
        return await listChannels(token, params);
      case "read_messages":
        return await readMessages(token, params);
      case "send_message":
        return await sendMessage(token, params);
      case "search_messages":
        return await searchMessages(token, params);
      case "get_thread":
        return await getThread(token, params);
      default:
        return jsonError(`Unknown action: ${action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function slackFetch(
  method: string,
  token: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(`${SLACK_API}/${method}`);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: params ? JSON.stringify(params) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) {
    throw new Error(`Slack API error: ${(data.error as string) ?? "unknown"}`);
  }

  return data;
}

async function listChannels(token: string, params?: Record<string, unknown>) {
  const data = await slackFetch("conversations.list", token, {
    types: "public_channel,private_channel",
    exclude_archived: true,
    limit: 200,
    ...params,
  });
  return NextResponse.json({ success: true, data: data.channels });
}

async function readMessages(token: string, params?: Record<string, unknown>) {
  const channelId = params?.channel_id as string | undefined;
  if (!channelId) {
    return jsonError("Missing params.channel_id");
  }

  const limit = (params?.limit as number) ?? 20;
  const data = await slackFetch("conversations.history", token, {
    channel: channelId,
    limit,
  });
  return NextResponse.json({ success: true, data: data.messages });
}

async function sendMessage(token: string, params?: Record<string, unknown>) {
  const channelId = params?.channel_id as string | undefined;
  const text = params?.text as string | undefined;
  if (!channelId || !text) {
    return jsonError("Missing params.channel_id or params.text");
  }

  const data = await slackFetch("chat.postMessage", token, {
    channel: channelId,
    text,
  });
  return NextResponse.json({ success: true, data: { ts: data.ts, channel: data.channel } });
}

async function searchMessages(token: string, params?: Record<string, unknown>) {
  const query = params?.query as string | undefined;
  if (!query) {
    return jsonError("Missing params.query");
  }

  const data = await slackFetch("search.messages", token, {
    query,
    count: 20,
    sort: "timestamp",
    sort_dir: "desc",
  });
  return NextResponse.json({ success: true, data: data.messages });
}

async function getThread(token: string, params?: Record<string, unknown>) {
  const channelId = params?.channel_id as string | undefined;
  const threadTs = params?.thread_ts as string | undefined;
  if (!channelId || !threadTs) {
    return jsonError("Missing params.channel_id or params.thread_ts");
  }

  const data = await slackFetch("conversations.replies", token, {
    channel: channelId,
    ts: threadTs,
  });
  return NextResponse.json({ success: true, data: data.messages });
}
