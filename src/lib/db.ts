import { PrismaClient } from '@prisma/client'

// Bump this after any prisma schema change + `bun run db:push`. The running
// dev server caches the PrismaClient instance in a global; a version mismatch
// discards the stale instance so the next module evaluation creates a fresh
// client that knows about the new/changed fields.
const SCHEMA_VERSION = 'v2-displayName'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion?: string
}

if (globalForPrisma.prismaSchemaVersion !== SCHEMA_VERSION) {
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect()
  }
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION
}
