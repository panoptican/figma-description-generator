/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { onTestFinished } from 'vitest'

import { D1Database, D1PreparedStatement } from '../types'

// Execute the production schema and SQL; only adapt D1's async calling convention.
export function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'))
  onTestFinished(() => sqlite.close())

  const db: D1Database = {
    prepare(sql: string): D1PreparedStatement {
      const statement = sqlite.prepare(sql)
      let bindings: Record<string, SQLInputValue> = {}
      return {
        bind(...values: unknown[]) {
          bindings = Object.fromEntries(values.map((value, index) => [`?${index + 1}`, value as SQLInputValue]))
          return this
        },
        async first<T>() {
          return (statement.get(bindings) ?? null) as T | null
        },
        async run() {
          return statement.run(bindings)
        },
        async all<T>() {
          return { results: statement.all(bindings) as T[] }
        },
      }
    },
  }
  return db
}
