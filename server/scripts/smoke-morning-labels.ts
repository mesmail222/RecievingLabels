import { getMorningLabels } from '../src/services/labelsService';

async function main() {
  const date = process.argv[2] || '2026-08-04';
  const result = await getMorningLabels(date);
  console.log(
    JSON.stringify(
      {
        date: result.date,
        source: result.source,
        filter: result.filter,
        count: result.labels.length,
        first: result.labels[0],
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
