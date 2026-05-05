import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.join(process.cwd(), ".ovao-config.json");

export interface GatewayConfig {
  gatewayUrl: string;
  gatewayToken: string;
}

export function readGatewayConfig(): GatewayConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "gatewayUrl" in parsed &&
      "gatewayToken" in parsed &&
      typeof (parsed as GatewayConfig).gatewayUrl === "string" &&
      typeof (parsed as GatewayConfig).gatewayToken === "string"
    ) {
      return parsed as GatewayConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeGatewayConfig(url: string, token: string): void {
  const config: GatewayConfig = { gatewayUrl: url, gatewayToken: token };
  const tmpPath = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
  fs.renameSync(tmpPath, CONFIG_PATH); // 原子写入：先写临时文件再重命名
}
