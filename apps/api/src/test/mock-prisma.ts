import { vi } from 'vitest';

type Delegate = Record<string, ReturnType<typeof vi.fn>>;

function emptyDelegate(): Delegate {
  return new Proxy(
    {},
    {
      get: (target: Delegate, prop: string) => {
        if (!target[prop]) {
          target[prop] = vi.fn();
        }
        return target[prop];
      },
    },
  ) as Delegate;
}

/**
 * Loose Prisma stub for unit tests. Nested model delegates auto-create vi.fn() methods.
 * Pass overrides for the models you actually assert on.
 */
export function createMockPrisma(overrides: Record<string, any> = {}) {
  const models: Record<string, any> = { ...overrides };

  const prisma: any = new Proxy(
    {
      $transaction: vi.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg;
      }),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      $disconnect: vi.fn(),
    },
    {
      get(target, prop: string) {
        if (prop in target) return (target as any)[prop];
        if (!models[prop]) models[prop] = emptyDelegate();
        return models[prop];
      },
    },
  );

  return prisma;
}
