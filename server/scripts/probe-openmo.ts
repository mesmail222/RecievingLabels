import { getDbConnection } from '../src/config/database';

async function main() {
  const pool = await getDbConnection();

  const openMoCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'OpenMO'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('OpenMO columns:');
  for (const row of openMoCols.recordset) {
    console.log(`  ${row.COLUMN_NAME} (${row.DATA_TYPE})`);
  }

  const sample = await pool.request().query(`
    SELECT TOP 5 *
    FROM [ScheduleDB].[dbo].[OpenMO]
    ORDER BY [StartDate] DESC
  `);
  console.log('\nOpenMO sample keys:', Object.keys(sample.recordset[0] || {}));
  console.log('OpenMO sample rows:', JSON.stringify(sample.recordset, null, 2));

  const billish = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME LIKE '%Bill%'
       OR TABLE_NAME LIKE '%BOM%'
       OR TABLE_NAME LIKE '%MOComp%'
       OR TABLE_NAME LIKE '%Comp%'
       OR TABLE_NAME LIKE '%Point%'
       OR TABLE_NAME LIKE '%OpenMO%'
    ORDER BY TABLE_NAME
  `);
  console.log('\nRelated tables/views:');
  for (const row of billish.recordset) {
    console.log(`  ${row.TABLE_TYPE}: ${row.TABLE_SCHEMA}.${row.TABLE_NAME}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
