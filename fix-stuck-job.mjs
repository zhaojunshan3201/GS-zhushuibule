import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

try {
  const result = await p.oracleImportRun.update({
    where: { id: '88f5fb3a-d1d4-4dfa-b094-fa5a2f207336' },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      error: 'Manually reset - stuck job'
    }
  });
  console.log('Fixed:', result.id, result.status);
} catch (e) {
  console.error(e);
} finally {
  await p.$disconnect();
}
