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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
