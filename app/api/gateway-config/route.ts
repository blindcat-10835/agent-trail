import { NextResponse } from "next/server";
import { readGatewayConfig } from "@/lib/gateway-config";

function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "****" + token.slice(-4);
}

export async function GET() {
  const config = readGatewayConfig();

  if (!config) {
    return NextResponse.json({
      gatewayUrl: process.env.NEXT_PUBLIC_GATEWAY_WS || "",
      gatewayToken: "",
    });
  }

  return NextResponse.json({
    gatewayUrl: config.gatewayUrl,
    gatewayToken: maskToken(config.gatewayToken),
  });
}
