import sql from 'mssql';
import { getDbConnection } from '../src/config/database';

async function main() {
  const pool = await getDbConnection();
  const mo = await pool.request().query(`
    SELECT MONumber, ItemNumber, ItemOrderedQuantity
    FROM ScheduleDB.dbo.OpenMO
    WHERE LTRIM(RTRIM(MONumber)) = 'EA-03770'
  `);
  console.log('OpenMO:', mo.recordset);

  const item = String(mo.recordset[0]?.ItemNumber || '').trim();
  const bom = await pool
    .request()
    .input('item', sql.VarChar, item)
    .query(`
      SELECT ItemNumber, CompNumber, CompDesc, RequiredQuantity, ComponentType
      FROM ScheduleDB.dbo.BOM
      WHERE LTRIM(RTRIM(ItemNumber)) = LTRIM(RTRIM(@item))
        AND LTRIM(RTRIM(ComponentType)) = 'N'
    `);
  console.log(`BOM for parent ${item}:`, bom.recordset);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
