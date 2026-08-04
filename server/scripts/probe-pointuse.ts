import { getDbConnection } from '../src/config/database';

async function main() {
  const pool = await getDbConnection();

  const cols = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE '%Point%'
       OR COLUMN_NAME LIKE '%Use%'
       OR COLUMN_NAME LIKE '%POU%'
       OR COLUMN_NAME LIKE '%WC%'
       OR COLUMN_NAME LIKE '%WorkCenter%'
       OR COLUMN_NAME LIKE '%Location%'
       OR COLUMN_NAME LIKE '%HDL%'
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log('Candidate columns:');
  for (const row of cols.recordset) {
    console.log(`  ${row.TABLE_SCHEMA}.${row.TABLE_NAME}.${row.COLUMN_NAME}`);
  }

  // Search object definitions for 5HDL if views
  const defs = await pool.request().query(`
    SELECT TOP 30 OBJECT_SCHEMA_NAME(object_id) AS sch, name
    FROM sys.objects
    WHERE OBJECT_DEFINITION(object_id) LIKE '%5HDL%'
       OR name LIKE '%5HDL%'
       OR name LIKE '%PointUse%'
       OR name LIKE '%Point_Use%'
    ORDER BY name
  `);
  console.log('\nObjects mentioning 5HDL/PointUse:');
  for (const row of defs.recordset) {
    console.log(`  ${row.sch}.${row.name}`);
  }

  // ComponentType really only N?
  const types = await pool.request().query(`
    SELECT LTRIM(RTRIM(ComponentType)) AS ComponentType, COUNT(*) AS cnt
    FROM [ScheduleDB].[dbo].[BOM]
    GROUP BY LTRIM(RTRIM(ComponentType))
  `);
  console.log('\nAll ComponentTypes:', types.recordset);

  // Join OpenMO created today to BOM on ItemNumber
  const joined = await pool.request().query(`
    SELECT TOP 20
      mo.MONumber,
      mo.ItemNumber AS MoItem,
      mo.ItemOrderedQuantity,
      bom.CompNumber,
      bom.CompDesc,
      bom.RequiredQuantity,
      bom.ComponentType,
      bom.OperationSequenceNumber
    FROM [ScheduleDB].[dbo].[OpenMO] mo
    INNER JOIN [ScheduleDB].[dbo].[BOM] bom
      ON LTRIM(RTRIM(mo.ItemNumber)) = LTRIM(RTRIM(bom.ItemNumber))
    WHERE CAST(mo.MOCreatedDate AS DATE) = CAST(GETDATE() AS DATE)
      AND LTRIM(RTRIM(bom.ComponentType)) = 'N'
    ORDER BY mo.MONumber, bom.OperationSequenceNumber
  `);
  console.log('\nToday MO + BOM N components sample count:', joined.recordset.length);
  console.log(JSON.stringify(joined.recordset.slice(0, 15), null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
