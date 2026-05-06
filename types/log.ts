export interface LogEntry {
  id: string;
  time: string;
  type: "lifecycle" | "tool" | "assistant" | "error";
  content: string;
  runId?: string;
  seq?: number | null;
}
