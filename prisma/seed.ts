import { Channel, ChannelHistory, PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new PrismaPg(
  { connectionString: 'postgresql://postgres:1234@localhost:5432/mydb' },
  { schema: 'privateapp' }
);

const prisma = new PrismaClient({ adapter: pool });

function main() {
  prisma.apiKey
    .create({
      data: {
        usage: 0,
        apiKey: 'AIzaSyDDe44x6EkzF2V0QOD1gecv929QSjD0dS4',
        name: 'YouTube-API',
        isActive: true,
        type: 'SERVER',
        userId: 'cmiq7jbog0000xzadecaejysv'
      }
    })
    .then((r) => console.log(r));
}

main();
