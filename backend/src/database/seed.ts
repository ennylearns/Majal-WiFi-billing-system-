import bcrypt from 'bcryptjs';
import { prisma } from './db';

async function main() {
  console.log('🌱 Seeding database...');

  const email = 'ennylearns@gmail.com';
  const rawPassword = 'seniola';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email,
      phone: '+2340000000000',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin user ready:', admin.email);
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });