import { NextRequest, NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordRequestBody {
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

  const token = authHeader.replace(/^Bot\s+/i, "");
  if (!token) {
    return jsonError("Invalid Authorization header", 401);
  }

  let body: DiscordRequestBody;
  try {
    body = (await req.json()) as DiscordRequestBody;
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
      case "list_guilds":
        return await listGuilds(token);
      default:
        return jsonError(`Unknown action: ${action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function discordFetch(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {
    Authorization: `Bot ${token}`,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Discord API HTTP ${res.status}: ${errorBody}`);
  }

  return res.json();
}

async function listChannels(token: string, params?: Record<string, unknown>) {
  const guildId = params?.guild_id as string | undefined;
  if (!guildId) {
    return jsonError("Missing params.guild_id");
  }

  const data = await discordFetch(`/guilds/${guildId}/channels`, token);
  return NextResponse.json({ success: true, data });
}

async function readMessages(token: string, params?: Record<string, unknown>) {
  const channelId = params?.channel_id as string | undefined;
  if (!channelId) {
    return jsonError("Missing params.channel_id");
  }

  const limit = (params?.limit as number) ?? 20;
  const data = await discordFetch(
    `/channels/${channelId}/messages?limit=${limit}`,
    token
  );
  return NextResponse.json({ success: true, data });
}

async function sendMessage(token: string, params?: Record<string, unknown>) {
  const channelId = params?.channel_id as string | undefined;
  const content = params?.content as string | undefined;
  if (!channelId || !content) {
    return jsonError("Missing params.channel_id or params.content");
  }

  const data = await discordFetch(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: { content },
  });
  return NextResponse.json({ success: true, data });
}

async function searchMessages(token: string, params?: Record<string, unknown>) {
  const guildId = params?.guild_id as string | undefined;
  const query = params?.query as string | undefined;
  if (!guildId || !query) {
    return jsonError("Missing params.guild_id or params.query");
  }

  const encoded = encodeURIComponent(query);
  const data = await discordFetch(
    `/guilds/${guildId}/messages/search?content=${encoded}`,
    token
  );
  return NextResponse.json({ success: true, data });
}

async function listGuilds(token: string) {
  const data = await discordFetch("/users/@me/guilds", token);
  return NextResponse.json({ success: true, data });
}
