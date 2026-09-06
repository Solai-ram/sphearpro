import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Global()
@Module({
  providers: [
    {
      provide: 'PRISMA_CLIENT',
      useFactory: () => {
        const client = new PrismaClient({
          log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
        return client;
      },
    },
  ],
  exports: ['PRISMA_CLIENT'],
})
export class PrismaModule {}