import { PrismaClient, DeliveryMode, ParcelStatus } from '@prisma/client';

const prisma = new PrismaClient();
const sender = await prisma.user.findUnique({ where: { email: 'sender@umbrella.tn' } });
if (!sender) throw new Error('sender missing — run npm run seed first');

const samples = [
  {
    code: '382936966281',
    recipientName: 'teest',
    phone: '51926850',
    governorate: 'Mahdia',
    city: 'Ksour Essaf',
    address: 'rue 54 amilkar zahra mahdia',
    price: 22,
    notes: '2026',
    mode: DeliveryMode.INTERNAL,
    status: ParcelStatus.ECHANGES,
    senderId: sender.id,
  },
  {
    code: '385237192281',
    recipientName: 'teest',
    phone: '51926850',
    governorate: 'Mahdia',
    city: 'Ksour Essaf',
    address: 'rue 54 amilkar zahra mahdia',
    price: 555,
    notes: 'teest',
    mode: DeliveryMode.INTERNAL,
    status: ParcelStatus.EN_ATTENTE,
    senderId: sender.id,
  },
  {
    code: '385237193281',
    recipientName: 'teest',
    phone: '51926850',
    governorate: 'Mahdia',
    city: 'Ksour Essaf',
    address: 'rue 54 amilkar zahra mahdia',
    price: 200,
    notes: 'teest',
    mode: DeliveryMode.EXTERNAL,
    status: ParcelStatus.EN_ATTENTE,
    senderId: sender.id,
    bordereauUrl: 'https://example.com/bordereau.pdf',
  },
];

for (const row of samples) {
  await prisma.parcel.upsert({
    where: { code: row.code },
    update: row,
    create: row,
  });
}

const count = await prisma.parcel.count();
console.log(`parcels=${count}`);
await prisma.$disconnect();
