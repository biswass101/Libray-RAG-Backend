export interface ShelfSlotSummary {
  id: string;
  code: string;
  label: string;
  capacity: number;
  used: number;
  available: number;
  description?: string | null;
  books: Array<{ id: string; title: string; availableCopies: number }>;
}

export function buildShelfSlotSummary(slot: ShelfSlotSummary): ShelfSlotSummary {
  const used = slot.books.length;
  return {
    ...slot,
    used,
    available: Math.max(0, slot.capacity - used),
  };
}
