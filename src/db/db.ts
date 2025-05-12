import { Kysely, PostgresDialect } from 'kysely'
import pkg from 'pg'
const { Pool } = pkg
import type { DatabaseSchema } from './schema.js' // Your defined schema types

export const db = new Kysely<DatabaseSchema>({
  dialect: new PostgresDialect({
    pool: new Pool({
      database: 'sakuga',
      user: 'user',
      password: 'user',
      host: 'localhost',
      port: 5432,
    }),
  }),
})
