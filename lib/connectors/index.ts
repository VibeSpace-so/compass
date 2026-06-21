import { IntegrationConnector } from "@/lib/integration-service";
import { NotionConnector } from "./notion";
import { GoogleDocsConnector } from "./google-docs";
import { FigmaConnector } from "./figma";
import { SlackConnector } from "./slack";
import { DiscordConnector } from "./discord";
import { VercelConnector } from "./vercel";
import { DevinConnector } from "./devin-connector";
import { LovableConnector } from "./lovable";
import { CursorConnector } from "./cursor";
import { ClaudeCodeConnector } from "./claude-code";
import { CodexConnector } from "./codex";
import { Base44Connector } from "./base44";
import { PerplexityConnector } from "./perplexity";

export { NotionConnector } from "./notion";
export { GoogleDocsConnector } from "./google-docs";
export { FigmaConnector } from "./figma";
export { SlackConnector } from "./slack";
export { DiscordConnector } from "./discord";
export { VercelConnector } from "./vercel";
export { DevinConnector } from "./devin-connector";
export { LovableConnector } from "./lovable";
export { CursorConnector } from "./cursor";
export { ClaudeCodeConnector } from "./claude-code";
export { CodexConnector } from "./codex";
export { Base44Connector } from "./base44";
export { PerplexityConnector } from "./perplexity";

export function createDefaultConnectors(): IntegrationConnector[] {
  return [
    new NotionConnector(),
    new GoogleDocsConnector(),
    new FigmaConnector(),
    new SlackConnector(),
    new DiscordConnector(),
    new VercelConnector(),
    new DevinConnector(),
    new LovableConnector(),
    new CursorConnector(),
    new ClaudeCodeConnector(),
    new CodexConnector(),
    new Base44Connector(),
    new PerplexityConnector(),
  ];
}
