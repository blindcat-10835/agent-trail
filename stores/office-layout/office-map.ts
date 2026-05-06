export type ZoneId = "workspace" | "collab" | "lounge";

export interface OfficeMap {
  slots: DeskSlot[];
}

export interface DeskSlot {
  id: string;
  zone: ZoneId;
  /** 瓦片列坐标（0-based） */
  tileX: number;
  /** 瓦片行坐标（0-based） */
  tileY: number;
  occupiedBy?: string;
}

export const DEFAULT_SLOTS: DeskSlot[] = [
  { id: "ws-0", zone: "workspace", tileX: 8, tileY: 4 },
  { id: "ws-1", zone: "workspace", tileX: 8, tileY: 6 },
  { id: "ws-2", zone: "workspace", tileX: 13, tileY: 4 },
  { id: "ws-3", zone: "workspace", tileX: 13, tileY: 6 },
  { id: "ws-4", zone: "workspace", tileX: 14, tileY: 4 },
  { id: "ws-5", zone: "workspace", tileX: 14, tileY: 6 },
  { id: "ws-6", zone: "workspace", tileX: 19, tileY: 4 },
  { id: "ws-7", zone: "workspace", tileX: 19, tileY: 6 },
  { id: "ws-8", zone: "workspace", tileX: 12, tileY: 9 },
  { id: "ws-9", zone: "workspace", tileX: 14, tileY: 9 },
  { id: "ws-10", zone: "workspace", tileX: 16, tileY: 9 },
  { id: "ws-11", zone: "workspace", tileX: 12, tileY: 12 },
  { id: "ws-12", zone: "workspace", tileX: 14, tileY: 12 },
  { id: "ws-13", zone: "workspace", tileX: 16, tileY: 12 },
  { id: "co-0", zone: "collab", tileX: 25, tileY: 8 },
  { id: "co-1", zone: "collab", tileX: 28, tileY: 8 },
  { id: "co-2", zone: "collab", tileX: 25, tileY: 10 },
  { id: "co-3", zone: "collab", tileX: 28, tileY: 10 },
  { id: "lo-0", zone: "lounge", tileX: 1.5, tileY: 5.0 },
  { id: "lo-1", zone: "lounge", tileX: 4, tileY: 6 },
  { id: "lo-2", zone: "lounge", tileX: 2.5, tileY: 3 },
  { id: "lo-3", zone: "lounge", tileX: 4.5, tileY: 3 },
];
