import { buildShelfSlotSummary } from './shelf-slot.utils';

describe('buildShelfSlotSummary', () => {
  it('calculates occupancy and remaining capacity for a slot', () => {
    const summary = buildShelfSlotSummary({
      id: 'slot-1',
      code: 'A-01',
      label: 'Aisle A / Slot 01',
      capacity: 4,
      description: 'North wall',
      books: [{ id: 'book-1', title: 'The Hobbit', availableCopies: 1 }],
    });

    expect(summary.used).toBe(1);
    expect(summary.available).toBe(3);
    expect(summary.label).toBe('Aisle A / Slot 01');
  });
});
