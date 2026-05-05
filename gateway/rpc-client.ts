import type { GatewayResponseFrame } from "./types";
import type { GatewayWsClient } from "./ws-client";

const DEFAULT_TIMEOUT_MS = 10_000;

export class RpcError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export class GatewayRpcClient {
  constructor(private wsClient: GatewayWsClient) {}

  request<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.wsClient.isConnected()) {
        reject(new RpcError("NOT_CONNECTED", "WebSocket is not connected"));
        return;
      }

      const id = crypto.randomUUID();
      let timer: ReturnType<typeof setTimeout> | null = null;
      let unsubscribeResponse: (() => void) | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        unsubscribeResponse?.();
        unsubscribeResponse = null;
      };

      unsubscribeResponse = this.wsClient.onResponse(id, (frame: GatewayResponseFrame) => {
        cleanup();
        if (frame.ok === true) {
          resolve(frame.payload as T);
        } else if (frame.ok === false) {
          reject(new RpcError(frame.error.code, frame.error.message));
        }
      });

      timer = setTimeout(() => {
        cleanup();
        reject(new RpcError("TIMEOUT", `RPC timeout: ${method}`));
      }, timeoutMs);

      this.wsClient.send({ type: "req", id, method, params });
    });
  }
}
