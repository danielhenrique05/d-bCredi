import type { QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{
    rows: R[];
    rowCount: number | null;
  }>;
}
export interface DatabaseClient extends Queryable { release(): void }
export interface Database extends Queryable { connect(): Promise<DatabaseClient> }

export async function transaction<T>(database: Database, work: (client: DatabaseClient) => Promise<T>): Promise<T> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
