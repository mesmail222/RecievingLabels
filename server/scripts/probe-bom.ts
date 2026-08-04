import { getDbConnection } from '../src/config/database';

async function main() {
  const pool = await getDbConnection();

  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'BOM'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('BOM columns:');
  for (const row of cols.recordset) {
    console.log(`  ${row.COLUMN_NAME} (${row.DATA_TYPE})`);
  }

  const sample = await pool.request().query(`
    SELECT TOP 10 * FROM [ScheduleDB].[dbo].[BOM]
  `);
  console.log('\nSample keys:', Object.keys(sample.recordset[0] || {}));
  console.log(JSON.stringify(sample.recordset, null, 2));

  const colNames = cols.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
  const typeCol =
    colNames.find((c) => /type/i.test(c) && !/item/i.test(c)) ||
    colNames.find((c) => /^type$/i.test(c));
  const pointCol = colNames.find((c) => /point/i.test(c) || /use/i.test(c));
  console.log('\nGuessed type col:', typeCol, 'point/use col:', pointCol);

  if (typeCol) {
    const types = await pool.request().query(`
      SELECT DISTINCT LTRIM(RTRIM(CAST([${typeCol}] AS NVARCHAR(50)))) AS v, COUNT(*) AS cnt
      FROM [ScheduleDB].[dbo].[BOM]
      GROUP BY LTRIM(RTRIM(CAST([${typeCol}] AS NVARCHAR(50))))
      ORDER BY cnt DESC
    `);
    console.log(`\nDistinct ${typeCol}:`, types.recordset);
  }
  if (pointCol) {
    const points = await pool.request().query(`
      SELECT DISTINCT LTRIM(RTRIM(CAST([${pointCol}] AS NVARCHAR(50)))) AS v, COUNT(*) AS cnt
      FROM [ScheduleDB].[dbo].[BOM]
      GROUP BY LTRIM(RTRIM(CAST([${pointCol}] AS NVARCHAR(50))))
      ORDER BY cnt DESC
    `);
    console.log(`\nDistinct ${pointCol} (top):`, points.recordset.slice(0, 30));
  }

  // Try joining a known parent from OpenMO created today
  const joinTest = await pool.request().query(`
    SELECT TOP 15
      mo.[MONumber],
      mo.[ItemNumber] AS ParentItem,
      bom.*
    FROM [ScheduleDB].[dbo].[OpenMO] mo
    INNER JOIN [ScheduleDB].[dbo].[BOM] bom
      ON LTRIM(RTRIM(mo.[ItemNumber])) = LTRIM(RTRIM(bom.[ParentItemNumber]))
      OR LTRIM(RTRIM(mo.[ItemNumber])) = LTRIM(RTRIM(bom.[PARENT]))
      OR LTRIM(RTRIM(mo.[ItemNumber])) = LTRIM(RTRIM(bom.[ItemNumber]))
    WHERE CAST(mo.[MOCreatedDate] AS DATE) = CAST(GETDATE() AS DATE)
  `).catch(async (err: Error) => {
    console.log('\nJoin attempt failed, probing parent column names:', err.message);
    return { recordset: [] as Record<string, unknown>[] };
  });

  if (joinTest.recordset.length) {
    console.log('\nJoin sample:', JSON.stringify(joinTest.recordset.slice(0, 5), null, 2));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
