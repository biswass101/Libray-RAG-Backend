import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const permission = await prisma.permission.upsert({
    where: { id: 'all-permission-id' },
    update: {},
    create: {
      id: 'all-permission-id',
      action: '*',
      description: 'Superuser permission',
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'System Administrator',
      permissions: {
        create: {
          permissionId: permission.id,
        },
      },
    },
  });

  const hash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@libraryos.io' },
    update: {
      password: hash,
    },
    create: {
      email: 'admin@libraryos.io',
      name: 'Admin User',
      password: hash,
      roleId: role.id,
    },
  });

  console.log('Seed completed. Admin User created:');
  console.log(`Email: ${admin.email}`);
  console.log(`Password: admin123`);

  // ─── DEMO DATA ─────────────────────────────────────────────────────────────

  const categorySpecs = [
    { name: 'Sci-Fi', description: 'Science fiction and speculative futures' },
    { name: 'Fantasy', description: 'Magic, myth and epic adventure' },
    { name: 'Non-Fiction', description: 'History, science and real-world topics' },
    { name: 'Mystery', description: 'Crime, thrillers and detective stories' },
  ];
  const categories = await Promise.all(
    categorySpecs.map((c) =>
      prisma.category.upsert({ where: { name: c.name }, update: {}, create: c }),
    ),
  );
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const authorSpecs = [
    { name: 'Ursula K. Le Guin', country: 'USA', bio: 'Author of the Earthsea and Hainish cycles.' },
    { name: 'Isaac Asimov', country: 'USA', bio: 'Prolific science fiction and popular science writer.' },
    { name: 'Agatha Christie', country: 'UK', bio: 'The queen of the classic whodunit.' },
    { name: 'Yuval Noah Harari', country: 'Israel', bio: 'Historian and author of Sapiens.' },
  ];
  const authors: Awaited<ReturnType<typeof prisma.author.create>>[] = [];
  for (const a of authorSpecs) {
    const existing = await prisma.author.findFirst({ where: { name: a.name } });
    authors.push(existing ?? (await prisma.author.create({ data: a })));
  }
  const authByName = Object.fromEntries(authors.map((a) => [a.name, a]));

  const publisherSpecs = [
    { name: 'Penguin Random House', website: 'https://penguinrandomhouse.com', address: 'New York, USA' },
    { name: 'HarperCollins', website: 'https://harpercollins.com', address: 'New York, USA' },
  ];
  const publishers: Awaited<ReturnType<typeof prisma.publisher.create>>[] = [];
  for (const p of publisherSpecs) {
    const existing = await prisma.publisher.findFirst({ where: { name: p.name } });
    publishers.push(existing ?? (await prisma.publisher.create({ data: p })));
  }

  // ─── SHELF SLOTS (create before books) ─────────────────────────────────────────
  const shelfSlotSpecs = [
    { code: 'A-01', label: 'North wall - Upper', capacity: 4, description: 'Premium display shelf' },
    { code: 'A-02', label: 'North wall - Lower', capacity: 5, description: 'High-traffic shelf' },
    { code: 'B-01', label: 'East wall - Upper', capacity: 4, description: 'Fiction section' },
    { code: 'B-02', label: 'East wall - Lower', capacity: 6, description: 'Large book storage' },
    { code: 'C-01', label: 'South wall', capacity: 4, description: 'Reference materials' },
  ];
  const shelfSlots = await Promise.all(
    shelfSlotSpecs.map((s) =>
      prisma.shelfSlot.upsert({
        where: { code: s.code },
        update: {},
        create: s,
      }),
    ),
  );
  const slotByCode = Object.fromEntries(shelfSlots.map((s) => [s.code, s]));

  const bookSpecs = [
    {
      title: 'The Left Hand of Darkness', isbn: '978-0441478125',
      category: 'Sci-Fi', author: 'Ursula K. Le Guin', publisher: 0,
      publishedYear: 1969, totalCopies: 5, availableCopies: 4,
      shelfSlot: 'A-01', shelfLocation: 'A-01', pages: 304, coverColor: '#4f46e5',
      description: 'A lone envoy on the planet Winter navigates politics and gender.',
      rating: 4.6,
    },
    {
      title: 'Foundation', isbn: '978-0553293357',
      category: 'Sci-Fi', author: 'Isaac Asimov', publisher: 0,
      publishedYear: 1951, totalCopies: 4, availableCopies: 2,
      shelfSlot: 'A-01', shelfLocation: 'A-01', pages: 255, coverColor: '#0ea5e9',
      description: 'The fall of a galactic empire and the science of psychohistory.',
      rating: 4.4,
    },
    {
      title: 'A Wizard of Earthsea', isbn: '978-0547773742',
      category: 'Fantasy', author: 'Ursula K. Le Guin', publisher: 1,
      publishedYear: 1968, totalCopies: 3, availableCopies: 3,
      shelfSlot: 'B-01', shelfLocation: 'B-01', pages: 183, coverColor: '#059669',
      description: 'Young Ged learns the true cost of power at the school of wizardry.',
      rating: 4.3,
    },
    {
      title: 'Murder on the Orient Express', isbn: '978-0062693662',
      category: 'Mystery', author: 'Agatha Christie', publisher: 1,
      publishedYear: 1934, totalCopies: 6, availableCopies: 5,
      shelfSlot: 'B-01', shelfLocation: 'B-01', pages: 256, coverColor: '#dc2626',
      description: 'Hercule Poirot untangles a murder aboard a snowbound train.',
      rating: 4.5,
    },
    {
      title: 'Sapiens: A Brief History of Humankind', isbn: '978-0062316097',
      category: 'Non-Fiction', author: 'Yuval Noah Harari', publisher: 1,
      publishedYear: 2011, totalCopies: 2, availableCopies: 0,
      shelfSlot: 'C-01', shelfLocation: 'C-01', pages: 443, coverColor: '#d97706',
      description: 'How Homo sapiens came to dominate the planet.',
      rating: 4.7,
    },
  ];
  const books = await Promise.all(
    bookSpecs.map(({ category, author, publisher, shelfSlot, ...b }) =>
      prisma.book.upsert({
        where: { isbn: b.isbn },
        update: {},
        create: {
          ...b,
          categoryId: catByName[category].id,
          authorId: authByName[author].id,
          publisherId: publishers[publisher].id,
          shelfSlotId: shelfSlot ? slotByCode[shelfSlot].id : undefined,
        },
      }),
    ),
  );
  const bookByIsbn = Object.fromEntries(books.map((b) => [b.isbn, b]));

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const memberSpecs = [
    { name: 'Alice Rahman', email: 'alice@example.com', phone: '+8801711000001', address: 'Dhanmondi, Dhaka', plan: 'premium', status: 'active' },
    { name: 'Bob Chowdhury', email: 'bob@example.com', phone: '+8801711000002', address: 'Uttara, Dhaka', plan: 'standard', status: 'active' },
    { name: 'Chris Das', email: 'chris@example.com', phone: '+8801711000003', address: 'Agrabad, Chattogram', plan: 'student', status: 'active' },
    { name: 'Dana Islam', email: 'dana@example.com', phone: '+8801711000004', address: 'Zindabazar, Sylhet', plan: 'standard', status: 'suspended' },
  ];
  const members = await Promise.all(
    memberSpecs.map((m) =>
      prisma.member.upsert({
        where: { email: m.email },
        update: {},
        create: { ...m, expiresAt: days(365) },
      }),
    ),
  );
  const memberByEmail = Object.fromEntries(members.map((m) => [m.email, m]));

  // Borrows / fines only on first run — they have no natural unique key to upsert on.
  const existingBorrows = await prisma.borrow.count();
  if (existingBorrows === 0) {
    // Active borrow, due soon
    await prisma.borrow.create({
      data: {
        bookId: bookByIsbn['978-0553293357'].id,
        memberId: memberByEmail['alice@example.com'].id,
        issuedAt: days(-10),
        dueAt: days(4),
        status: 'borrowed',
      },
    });
    // Active borrow, overdue
    await prisma.borrow.create({
      data: {
        bookId: bookByIsbn['978-0062316097'].id,
        memberId: memberByEmail['bob@example.com'].id,
        issuedAt: days(-20),
        dueAt: days(-6),
        status: 'overdue',
      },
    });
    // Returned late, with a fine
    const lateBorrow = await prisma.borrow.create({
      data: {
        bookId: bookByIsbn['978-0441478125'].id,
        memberId: memberByEmail['chris@example.com'].id,
        issuedAt: days(-30),
        dueAt: days(-16),
        returnedAt: days(-12),
        status: 'returned',
        fineAmount: 2,
      },
    });
    await prisma.fine.create({
      data: {
        borrowId: lateBorrow.id,
        memberId: memberByEmail['chris@example.com'].id,
        amount: 2,
        reason: 'Overdue fine',
        status: 'unpaid',
      },
    });
    // Renewed borrow
    await prisma.borrow.create({
      data: {
        bookId: bookByIsbn['978-0062693662'].id,
        memberId: memberByEmail['alice@example.com'].id,
        issuedAt: days(-18),
        dueAt: days(10),
        renewCount: 1,
        status: 'renewed',
      },
    });

    // Keep member/book counters consistent with the records above
    await prisma.member.update({
      where: { email: 'alice@example.com' },
      data: { activeBorrows: 2, totalBorrows: 2 },
    });
    await prisma.member.update({
      where: { email: 'bob@example.com' },
      data: { activeBorrows: 1, totalBorrows: 1 },
    });
    await prisma.member.update({
      where: { email: 'chris@example.com' },
      data: { totalBorrows: 1, outstandingFines: 2 },
    });
    await prisma.book.update({
      where: { isbn: '978-0553293357' },
      data: { availableCopies: 3, borrowCount: 1 },
    });
    await prisma.book.update({
      where: { isbn: '978-0062316097' },
      data: { availableCopies: 1, borrowCount: 1 },
    });
    await prisma.book.update({
      where: { isbn: '978-0441478125' },
      data: { borrowCount: 1 },
    });
    await prisma.book.update({
      where: { isbn: '978-0062693662' },
      data: { availableCopies: 4, borrowCount: 1 },
    });
  }

  const existingReservations = await prisma.reservation.count();
  if (existingReservations === 0) {
    await prisma.reservation.create({
      data: {
        bookId: bookByIsbn['978-0062316097'].id,
        memberId: memberByEmail['chris@example.com'].id,
        queuePosition: 1,
        status: 'pending',
        expiresAt: days(7),
      },
    });
    await prisma.reservation.create({
      data: {
        bookId: bookByIsbn['978-0062316097'].id,
        memberId: memberByEmail['dana@example.com'].id,
        queuePosition: 2,
        status: 'pending',
        expiresAt: days(7),
      },
    });
  }

  console.log(
    `Demo data ready: ${categories.length} categories, ${authors.length} authors, ` +
    `${publishers.length} publishers, ${shelfSlots.length} shelf slots, ${books.length} books, ${members.length} members.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
