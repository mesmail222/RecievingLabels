import sql from 'mssql';
import { getDbConnection } from '../src/config/database';
import { LABEL_COMPONENT_TYPE } from '../src/config/constants';

async function countComponents(excludeWinding: boolean) {
  const pool = await getDbConnection();
  const windingClause = excludeWinding
    ? `AND LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) NOT LIKE '%WINDING%'`
    : '';

  const result = await pool
    .request()
    .input('componentType', sql.VarChar(10), LABEL_COMPONENT_TYPE)
    .query(`
      SELECT
        COUNT(*) AS ComponentRows,
        COUNT(DISTINCT LTRIM(RTRIM(mo.[MONumber])) + '|' + LTRIM(RTRIM(mo.[ItemNumber]))) AS MoLines
      FROM [ScheduleDB].[dbo].[OpenMO] mo
      INNER JOIN [ScheduleDB].[dbo].[BOM] bom
        ON LTRIM(RTRIM(mo.[ItemNumber])) = LTRIM(RTRIM(bom.[ItemNumber]))
       AND LTRIM(RTRIM(bom.[ComponentType])) = @componentType
       AND LEFT(LTRIM(RTRIM(bom.[CompNumber])), 1) <> '2'
       AND LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) NOT LIKE '%BLANK%'
       AND LEFT(LTRIM(RTRIM(CAST(bom.[OperationSequenceNumber] AS VARCHAR(20)))), 1) = '5'
       ${windingClause}
       AND (
            bom.[InEffectivityDate] IS NULL
         OR CAST(bom.[InEffectivityDate] AS DATE) <= CAST(mo.[MOCreatedDate] AS DATE)
       )
       AND (
            bom.[OutEffectivityDate] IS NULL
         OR CAST(bom.[OutEffectivityDate] AS DATE) >= CAST(mo.[MOCreatedDate] AS DATE)
       )
      WHERE CAST(mo.[MOCreatedDate] AS DATE) = CAST(GETDATE() AS DATE)
        AND LEFT(LTRIM(RTRIM(mo.[ItemNumber])), 1) <> '2'
        AND LTRIM(RTRIM(ISNULL(mo.[ItemDescription], ''))) NOT LIKE '%BLANK%'
    `);

  const windingSample = await pool.request().query(`
    SELECT TOP 10
      LTRIM(RTRIM(mo.[MONumber])) AS MONumber,
      LTRIM(RTRIM(bom.[CompNumber])) AS CompNumber,
      LTRIM(RTRIM(bom.[CompDesc])) AS CompDesc
    FROM [ScheduleDB].[dbo].[OpenMO] mo
    INNER JOIN [ScheduleDB].[dbo].[BOM] bom
      ON LTRIM(RTRIM(mo.[ItemNumber])) = LTRIM(RTRIM(bom.[ItemNumber]))
     AND LTRIM(RTRIM(bom.[ComponentType])) = 'N'
     AND LEFT(LTRIM(RTRIM(bom.[CompNumber])), 1) <> '2'
     AND LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) NOT LIKE '%BLANK%'
     AND LEFT(LTRIM(RTRIM(CAST(bom.[OperationSequenceNumber] AS VARCHAR(20)))), 1) = '5'
     AND LTRIM(RTRIM(ISNULL(bom.[CompDesc], ''))) LIKE '%WINDING%'
    WHERE CAST(mo.[MOCreatedDate] AS DATE) = CAST(GETDATE() AS DATE)
      AND LEFT(LTRIM(RTRIM(mo.[ItemNumber])), 1) <> '2'
      AND LTRIM(RTRIM(ISNULL(mo.[ItemDescription], ''))) NOT LIKE '%BLANK%'
  `);

  return {
    stats: result.recordset[0],
    windingSample: windingSample.recordset,
  };
}

async function main() {
  const before = await countComponents(false);
  const after = await countComponents(true);

  const beforeCount = Number(before.stats.ComponentRows);
  const afterCount = Number(after.stats.ComponentRows);

  console.log(
    JSON.stringify(
      {
        date: new Date().toISOString().slice(0, 10),
        beforeWindingFilter: {
          componentRows: beforeCount,
          moLines: Number(before.stats.MoLines),
        },
        afterWindingFilter: {
          componentRows: afterCount,
          moLines: Number(after.stats.MoLines),
        },
        filteredOut: beforeCount - afterCount,
        sampleWindingCompsRemoved: before.windingSample,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
