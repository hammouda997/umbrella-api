/**
 * Create or update a single SUPER_ADMIN without wiping the database.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=ops@umbrella.tn \
 *   BOOTSTRAP_ADMIN_PASSWORD='StrongPass1' \
 *   BOOTSTRAP_ADMIN_NAME='Ops Admin' \
 *   npm run db:bootstrap-admin
 */
import { ApprovalStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  const name = (process.env.BOOTSTRAP_ADMIN_NAME ?? 'Super Admin').trim();
  const phone = (process.env.BOOTSTRAP_ADMIN_PHONE ?? '').trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is required (valid email)');
  }
  if (password.length < 10) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must include a letter and a digit');
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      phone,
      password: hash,
      role: Role.SUPER_ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      isActive: true,
    },
    update: {
      name,
      phone,
      password: hash,
      role: Role.SUPER_ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      isActive: true,
    },
  });

  console.log(`Bootstrap SUPER_ADMIN ready: ${user.email} (id=${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
