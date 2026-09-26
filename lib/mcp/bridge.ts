import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient: Client | null = null;
let mcpTransport: StdioClientTransport | null = null;

/**
 * Initializes or returns a singleton MCP client connected to the local intervals-icu-mcp Python server.
 */
export async function getLocalMCPClient(): Promise<Client | null> {
  if (process.env.USE_LOCAL_MCP !== "true") {
    return null;
  }

  if (mcpClient) {
    return mcpClient;
  }

  try {
    const projectPath =
      process.env.MCP_SERVER_PATH || "../intervals-icu-mcp";
    const apiKey = process.env.INTERVALS_ICU_API_KEY || "";
    const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID || "";

    mcpTransport = new StdioClientTransport({
      command: "uv",
      args: ["run", "--project", projectPath, "intervals-icu-mcp"],
      env: {
        ...process.env,
        INTERVALS_ICU_API_KEY: apiKey,
        INTERVALS_ICU_ATHLETE_ID: athleteId,
      },
    });

    const client = new Client(
      {
        name: "cycling-coach-web",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(mcpTransport);
    mcpClient = client;
    console.log("[MCP Bridge] Connected to local intervals-icu-mcp server.");
    return mcpClient;
  } catch (error) {
    console.warn("[MCP Bridge] Failed to connect to local MCP server, falling back to direct API:", error);
    return null;
  }
}
