import { NextRequest, NextResponse } from "next/server";

const WORKSPACE_PATH = process.env.WORKSPACE_PATH || "";

function getOpenclawBase(): string {
  if (!WORKSPACE_PATH) return "";
  // WORKSPACE_PATH=/Users/xxx/.openclaw/workspace -> parent is /Users/xxx/.openclaw
  const parts = WORKSPACE_PATH.replace(/\/+$/, "").split("/");
  parts.pop(); // remove "workspace"
  return parts.join("/");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  // Sanitize sessionId to prevent directory traversal
  const sanitizedId = sessionId.replace(/[^a-zA-Z0-9\-_:.]/g, "");

  // Extract UUID part from session key like "agent:blue:uuid" or plain "uuid"
  const uuidMatch = sanitizedId.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  const uuid = uuidMatch ? uuidMatch[0] : sanitizedId;

  // Extract agent name from session key "agent:blue:..." -> "blue"
  const agentMatch = sanitizedId.match(/^agent:([^:]+):/);
  const agentName = agentMatch ? agentMatch[1] : null;

  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const baseDir = getOpenclawBase();
    if (!baseDir) {
      return NextResponse.json(
        { error: "WORKSPACE_PATH not configured" },
        { status: 500 }
      );
    }

    const agentsDir = path.join(baseDir, "agents");

    // If agent name is known, search directly in that agent's sessions dir
    if (agentName) {
      const directPath = path.join(
        agentsDir,
        agentName,
        "sessions",
        `${uuid}.jsonl`
      );
      try {
        const content = await fs.readFile(directPath, "utf8");
        const messages = parseMessages(content);
        return NextResponse.json(messages, { status: 200 });
      } catch {
        // File not found in expected location, fall through to recursive search
      }
    }

    // Recursive search across all agent session directories
    const targetFile = await findSessionFile(agentsDir, uuid);
    if (!targetFile) {
      return NextResponse.json([], { status: 200 });
    }

    const content = await fs.readFile(targetFile, "utf8");
    const messages = parseMessages(content);
    return NextResponse.json(messages, { status: 200 });
  } catch (error) {
    console.error("Error reading session messages:", error);
    return NextResponse.json(
      { error: "Failed to read session messages" },
      { status: 500 }
    );
  }
}

async function findSessionFile(
  agentsDir: string,
  uuid: string
): Promise<string | null> {
  const fs = await import("fs/promises");
  const path = await import("path");

  try {
    const agentDirs = await fs.readdir(agentsDir);
    for (const agentDir of agentDirs) {
      const sessionsDir = path.join(agentsDir, agentDir, "sessions");
      try {
        const files = await fs.readdir(sessionsDir);
        const match = files.find(
          (f) => f.includes(uuid) && f.endsWith(".jsonl")
        );
        if (match) {
          return path.join(sessionsDir, match);
        }
      } catch {
        // Agent has no sessions dir, skip
      }
    }
  } catch {
    // agents dir doesn't exist
  }

  return null;
}

function parseMessages(
  content: string
): Array<{ role: string; content: string; timestamp: string }> {
  const lines = content.split("\n").filter((l) => l.trim());
  const messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }> = [];
  const startIndex = Math.max(0, lines.length - 30);

  for (let i = startIndex; i < lines.length; i++) {
    try {
      const d = JSON.parse(lines[i]);
      if (d.type !== "message") continue;

      const msg = d.message;
      if (!msg) continue;

      let text = "";
      if (typeof msg.content === "string") {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b.type === "text" && b.text) {
            text = b.text;
            break;
          }
          if (b.type === "tool_use" || b.type === "toolCall") {
            text = "🔧 " + (b.name || b.toolName || "tool");
            break;
          }
        }
      }

      if (text) {
        messages.push({
          role: msg.role || "unknown",
          content: text.substring(0, 300),
          timestamp: d.timestamp || "",
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return messages;
}
