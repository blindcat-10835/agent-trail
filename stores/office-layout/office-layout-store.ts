import { create } from "zustand";

import { DEFAULT_SLOTS, type DeskSlot, type ZoneId } from "./office-map";

const LAYOUT_STORAGE_KEY = "ovao.workspace.layout.v1";
const LAYOUT_SNAPSHOT_VERSION = 1;
const LAYOUT_SNAPSHOT_TTL_MS = 15 * 60 * 1000;
const LAYOUT_PERSIST_DEBOUNCE_MS = 200;

interface LayoutSnapshotV1 {
  version: 1;
  updatedAt: number;
  agentZone: Record<string, ZoneId>;
  slotOccupancy: Record<string, string>;
}

interface OfficeLayoutState {
  slots: DeskSlot[];
  agentZone: Record<string, ZoneId>;

  assignSlot: (agentId: string, zone: ZoneId) => DeskSlot | null;
  releaseSlot: (agentId: string) => void;
  getAgentSlot: (agentId: string) => DeskSlot | undefined;
  reset: () => void;
}

function isZoneId(value: unknown): value is ZoneId {
  return value === "workspace" || value === "collab" || value === "lounge";
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readLayoutSnapshot(): LayoutSnapshotV1 | null {
  if (!hasBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LayoutSnapshotV1>;
    if (parsed.version !== LAYOUT_SNAPSHOT_VERSION) return null;
    if (typeof parsed.updatedAt !== "number") return null;
    if (!isStringRecord(parsed.slotOccupancy) || !isStringRecord(parsed.agentZone)) return null;
    if (Date.now() - parsed.updatedAt > LAYOUT_SNAPSHOT_TTL_MS) return null;

    const agentZone: Record<string, ZoneId> = {};
    for (const [agentId, zone] of Object.entries(parsed.agentZone)) {
      if (isZoneId(zone)) {
        agentZone[agentId] = zone;
      }
    }

    return {
      version: 1,
      updatedAt: parsed.updatedAt,
      slotOccupancy: parsed.slotOccupancy,
      agentZone,
    };
  } catch {
    return null;
  }
}

function persistLayoutSnapshot(state: Pick<OfficeLayoutState, "slots" | "agentZone">): void {
  if (!hasBrowserStorage()) return;

  const slotOccupancy: Record<string, string> = {};
  for (const slot of state.slots) {
    if (slot.occupiedBy) {
      slotOccupancy[slot.id] = slot.occupiedBy;
    }
  }

  const snapshot: LayoutSnapshotV1 = {
    version: 1,
    updatedAt: Date.now(),
    agentZone: { ...state.agentZone },
    slotOccupancy,
  };

  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota/security errors; in-memory state still works
  }
}

function makeBaseState() {
  return {
    slots: DEFAULT_SLOTS.map((slot) => ({ ...slot, occupiedBy: undefined })),
    agentZone: {} as Record<string, ZoneId>,
  };
}

function makeInitialState() {
  const base = makeBaseState();
  const snapshot = readLayoutSnapshot();
  if (!snapshot) return base;

  const seenAgents = new Set<string>();
  const slots = base.slots.map((slot) => {
    const occupiedBy = snapshot.slotOccupancy[slot.id];
    if (!occupiedBy || seenAgents.has(occupiedBy)) return slot;
    seenAgents.add(occupiedBy);
    return { ...slot, occupiedBy };
  });

  const agentZone: Record<string, ZoneId> = { ...snapshot.agentZone };
  for (const slot of slots) {
    if (slot.occupiedBy && !agentZone[slot.occupiedBy]) {
      agentZone[slot.occupiedBy] = slot.zone;
    }
  }

  return {
    slots,
    agentZone,
  };
}

export const useOfficeLayoutStore = create<OfficeLayoutState>()((set, get) => {
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  const clearPersistTimer = () => {
    if (!persistTimer) return;
    clearTimeout(persistTimer);
    persistTimer = null;
  };

  const schedulePersist = () => {
    clearPersistTimer();
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistLayoutSnapshot(get());
    }, LAYOUT_PERSIST_DEBOUNCE_MS);
  };

  return {
    ...makeInitialState(),

    assignSlot: (agentId: string, zone: ZoneId) => {
      const state = get();
      const currentSlot = state.slots.find((slot) => slot.occupiedBy === agentId);
      if (currentSlot?.zone === zone) {
        return currentSlot;
      }

      const releasedSlots = state.slots.map((slot) =>
        slot.occupiedBy === agentId ? { ...slot, occupiedBy: undefined } : slot,
      );
      const freeSlot = releasedSlots.find((slot) => slot.zone === zone && !slot.occupiedBy);
      if (!freeSlot) return null;

      const assignedSlot = { ...freeSlot, occupiedBy: agentId };
      set({
        slots: releasedSlots.map((slot) => (slot.id === freeSlot.id ? assignedSlot : slot)),
        agentZone: { ...state.agentZone, [agentId]: zone },
      });
      schedulePersist();
      return assignedSlot;
    },

    releaseSlot: (agentId: string) => {
      set((state) => ({
        slots: state.slots.map((slot) => (slot.occupiedBy === agentId ? { ...slot, occupiedBy: undefined } : slot)),
        agentZone: Object.fromEntries(Object.entries(state.agentZone).filter(([id]) => id !== agentId)),
      }));
      schedulePersist();
    },

    getAgentSlot: (agentId: string) => get().slots.find((slot) => slot.occupiedBy === agentId),

    reset: () => {
      clearPersistTimer();
      set(makeInitialState());
    },
  };
});
