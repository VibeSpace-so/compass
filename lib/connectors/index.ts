import { IntegrationConnector } from "@/lib/integration-service";
import { NotionConnector } from "./notion";
import { GoogleDocsConnector } from "./google-docs";
import { FigmaConnector } from "./figma";
import { SlackConnector } from "./slack";
import { DiscordConnector } from "./discord";

export { NotionConnector } from "./notion";
export { GoogleDocsConnector } from "./google-docs";
export { FigmaConnector } from "./figma";
export { SlackConnector } from "./slack";
export { DiscordConnector } from "./discord";

export function createDefaultConnectors(): IntegrationConnector[] {
  return [
    new NotionConnector(),
    new GoogleDocsConnector(),
    new FigmaConnector(),
    new SlackConnector(),
    new DiscordConnector(),
  ];
}
