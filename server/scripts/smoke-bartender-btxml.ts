import assert from 'node:assert/strict';
import http from 'node:http';
import {
  buildBarTenderXml,
  printWithBarTender,
  validatePrintLabels,
} from '../src/services/bartenderService';

const labels = validatePrintLabels([
  {
    moNumber: 'MF-1 & TEST',
    createdDate: '08/05/26',
    qty: 12,
    itemNumber: 'ASSEMBLY-1',
    components: Array.from({ length: 9 }, (_, index) => ({
      itemNumber: `COMP-${index + 1}`,
      qty: index + 0.5,
    })),
  },
]);

const { xml, labelCount } = buildBarTenderXml(
  labels,
  'C:\\BarTender\\RecievingFormat.btw',
  'Receiving & Label Printer',
);

assert.equal(labelCount, 2);
assert.match(xml, /MF-1 &amp; TEST \(1\/2\)/);
assert.match(xml, /MF-1 &amp; TEST \(2\/2\)/);
assert.match(xml, /Receiving &amp; Label Printer/);
assert.equal((xml.match(/<Command /g) ?? []).length, 2);
assert.equal((xml.match(/NamedSubString Name="Component Item 8"/g) ?? []).length, 2);
assert.match(
  xml,
  /NamedSubString Name="Component Item 2">\s*<Value><\/Value>/,
  'The second continuation row should be cleared explicitly.',
);

async function main(): Promise<void> {
  let receivedBody = '';
  let receivedAuthorization = '';
  const server = http.createServer((request, response) => {
    receivedAuthorization = request.headers.authorization ?? '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      receivedBody += chunk;
    });
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/xml' });
      response.end(
        '<Response Version="2.0"><Command><Print JobLastStatus="Sent" JobCompleted="true" /></Command></Response>',
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.BARTENDER_INTEGRATION_URL = `http://127.0.0.1:${address.port}/ReceivingLabels`;
    process.env.BARTENDER_TEMPLATE_PATH = 'C:\\BarTender\\RecievingFormat.btw';
    process.env.BARTENDER_PRINTER_NAME = 'Receiving Label Printer';
    process.env.BARTENDER_USERNAME = 'shock';
    process.env.BARTENDER_PASSWORD = 'test-password';

    const result = await printWithBarTender(labels);
    assert.equal(result.status, 'queued');
    assert.equal(result.labelsQueued, 2);
    assert.match(receivedBody, /<XMLScript Version="2.0"/);
    assert.equal(
      receivedAuthorization,
      `Basic ${Buffer.from('shock:test-password').toString('base64')}`,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  console.log('BarTender BTXML and integration HTTP smoke tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
