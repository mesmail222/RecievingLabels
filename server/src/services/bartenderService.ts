import { randomUUID } from 'crypto';
import type { MoLabel } from './labelsService';

const COMPONENTS_PER_LABEL = 8;
const MAX_MOS_PER_REQUEST = 100;
const MAX_PRINTED_LABELS_PER_REQUEST = 250;
const DEFAULT_TIMEOUT_MS = 120_000;

interface BarTenderConfig {
  integrationUrl: string;
  templatePath: string;
  printerName: string;
  username?: string;
  password?: string;
  timeoutMs: number;
}

export interface BarTenderStatus {
  configured: boolean;
  printerName: string | null;
  message: string;
}

export interface BarTenderPrintResult {
  status: 'queued';
  labelsQueued: number;
  mosSubmitted: number;
  printerName: string;
}

export class BarTenderRequestError extends Error {}
export class BarTenderConfigurationError extends Error {}
export class BarTenderIntegrationError extends Error {}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function parseTimeout(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 300_000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.round(parsed);
}

function readConfig(): { config: BarTenderConfig | null; missing: string[] } {
  const integrationUrl = env('BARTENDER_INTEGRATION_URL');
  const templatePath = env('BARTENDER_TEMPLATE_PATH');
  const printerName = env('BARTENDER_PRINTER_NAME');
  const username = env('BARTENDER_USERNAME');
  const password = env('BARTENDER_PASSWORD');
  const missing: string[] = [];

  if (!integrationUrl) missing.push('BARTENDER_INTEGRATION_URL');
  if (!templatePath) missing.push('BARTENDER_TEMPLATE_PATH');
  if (!printerName) missing.push('BARTENDER_PRINTER_NAME');
  if ((username && !password) || (!username && password)) {
    missing.push('BARTENDER_USERNAME and BARTENDER_PASSWORD must be set together');
  }

  if (missing.length > 0) return { config: null, missing };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(integrationUrl);
  } catch {
    return { config: null, missing: ['BARTENDER_INTEGRATION_URL is not a valid URL'] };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    return {
      config: null,
      missing: ['BARTENDER_INTEGRATION_URL must be an HTTP(S) URL without embedded credentials'],
    };
  }

  return {
    config: {
      integrationUrl: parsedUrl.toString(),
      templatePath,
      printerName,
      username: username || undefined,
      password: password || undefined,
      timeoutMs: parseTimeout(env('BARTENDER_TIMEOUT_MS')),
    },
    missing: [],
  };
}

export function getBarTenderStatus(): BarTenderStatus {
  const { config, missing } = readConfig();
  if (!config) {
    return {
      configured: false,
      printerName: null,
      message: `BarTender printing is not configured (${missing.join(', ')}).`,
    };
  }

  return {
    configured: true,
    printerName: config.printerName,
    message: `BarTender printing is configured for ${config.printerName}.`,
  };
}

function requiredString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BarTenderRequestError(`${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BarTenderRequestError(`${field} is too long.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength = 500): string | undefined {
  if (value == null || value === '') return undefined;
  return requiredString(value, field, maxLength);
}

function nonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BarTenderRequestError(`${field} must be a non-negative number.`);
  }
  return value;
}

export function validatePrintLabels(value: unknown): MoLabel[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BarTenderRequestError('Select at least one MO label to print.');
  }
  if (value.length > MAX_MOS_PER_REQUEST) {
    throw new BarTenderRequestError(`A maximum of ${MAX_MOS_PER_REQUEST} MOs can be printed at once.`);
  }

  const labels = value.map((candidate, labelIndex): MoLabel => {
    if (!candidate || typeof candidate !== 'object') {
      throw new BarTenderRequestError(`labels[${labelIndex}] is invalid.`);
    }

    const raw = candidate as Record<string, unknown>;
    if (!Array.isArray(raw.components)) {
      throw new BarTenderRequestError(`labels[${labelIndex}].components must be an array.`);
    }

    return {
      moNumber: requiredString(raw.moNumber, `labels[${labelIndex}].moNumber`, 100),
      createdDate: requiredString(raw.createdDate, `labels[${labelIndex}].createdDate`, 32),
      qty: nonNegativeNumber(raw.qty, `labels[${labelIndex}].qty`),
      itemNumber: requiredString(raw.itemNumber, `labels[${labelIndex}].itemNumber`, 100),
      itemDescription: optionalString(
        raw.itemDescription,
        `labels[${labelIndex}].itemDescription`,
      ),
      components: raw.components.map((component, componentIndex) => {
        if (!component || typeof component !== 'object') {
          throw new BarTenderRequestError(
            `labels[${labelIndex}].components[${componentIndex}] is invalid.`,
          );
        }
        const rawComponent = component as Record<string, unknown>;
        return {
          itemNumber: requiredString(
            rawComponent.itemNumber,
            `labels[${labelIndex}].components[${componentIndex}].itemNumber`,
            100,
          ),
          qty: nonNegativeNumber(
            rawComponent.qty,
            `labels[${labelIndex}].components[${componentIndex}].qty`,
          ),
          description: optionalString(
            rawComponent.description,
            `labels[${labelIndex}].components[${componentIndex}].description`,
          ),
        };
      }),
    };
  });

  const printedLabelCount = labels.reduce(
    (total, label) => total + Math.max(1, Math.ceil(label.components.length / COMPONENTS_PER_LABEL)),
    0,
  );
  if (printedLabelCount > MAX_PRINTED_LABELS_PER_REQUEST) {
    throw new BarTenderRequestError(
      `This selection would print ${printedLabelCount} labels; the limit is ${MAX_PRINTED_LABELS_PER_REQUEST}.`,
    );
  }

  return labels;
}

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function namedDataSource(name: string, value: string | number): string {
  return [
    `      <NamedSubString Name="${escapeXml(name)}">`,
    `        <Value>${escapeXml(value)}</Value>`,
    '      </NamedSubString>',
  ].join('\n');
}

export function buildBarTenderXml(
  labels: MoLabel[],
  templatePath: string,
  printerName: string,
): { xml: string; labelCount: number } {
  const commands: string[] = [];

  for (const label of labels) {
    const pageCount = Math.max(1, Math.ceil(label.components.length / COMPONENTS_PER_LABEL));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const pageComponents = label.components.slice(
        pageIndex * COMPONENTS_PER_LABEL,
        (pageIndex + 1) * COMPONENTS_PER_LABEL,
      );
      const moDisplay =
        pageCount > 1 ? `${label.moNumber} (${pageIndex + 1}/${pageCount})` : label.moNumber;
      const values: Array<[string, string | number]> = [
        ['MO Date', `DATE: ${label.createdDate}`],
        ['MO Number', moDisplay],
        ['MO Quantity', `QTY: ${label.qty}`],
      ];

      for (let row = 0; row < COMPONENTS_PER_LABEL; row += 1) {
        const component = pageComponents[row];
        values.push([`Component Item ${row + 1}`, component?.itemNumber ?? '']);
        values.push([`Component Qty ${row + 1}`, component ? `QTY: ${component.qty}` : '']);
      }

      const commandName = `Receiving ${label.moNumber} ${pageIndex + 1}`;
      commands.push(
        [
          `  <Command Name="${escapeXml(commandName)}">`,
          '    <Print WaitForJobToComplete="false" Timeout="60000" ReturnPrintData="false" ReturnSummary="true" ReturnLabelData="false" ReturnChecksum="false">',
          `      <Format CloseAtEndOfJob="true" SaveAtEndOfJob="false">${escapeXml(templatePath)}</Format>`,
          '      <PrintSetup>',
          `        <Printer>${escapeXml(printerName)}</Printer>`,
          '        <IdenticalCopiesOfLabel>1</IdenticalCopiesOfLabel>',
          '        <EnablePrompting>false</EnablePrompting>',
          '        <UseDatabase>false</UseDatabase>',
          '      </PrintSetup>',
          ...values.map(([name, value]) => namedDataSource(name, value)),
          '    </Print>',
          '  </Command>',
        ].join('\n'),
      );
    }
  }

  const id = randomUUID();
  return {
    xml: [
      '<?xml version="1.0" encoding="utf-8"?>',
      `<XMLScript Version="2.0" Name="Receiving Labels" ID="${id}">`,
      ...commands,
      '</XMLScript>',
    ].join('\n'),
    labelCount: commands.length,
  };
}

function responseError(body: string): string | null {
  if (!body) return null;
  const failed =
    /Severity\s*=\s*["']Error["']/i.test(body) ||
    /(?:JobLastStatus|Status)\s*=\s*["']Failed["']/i.test(body) ||
    /"Status"\s*:\s*"(?:Faulted|Failed)"/i.test(body);
  if (!failed) return null;

  const message = body.match(/<Message\b[^>]*Severity\s*=\s*["']Error["'][^>]*>([\s\S]*?)<\/Message>/i)?.[1];
  if (message) {
    return message
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1_000);
  }
  return 'BarTender reported that one or more print jobs failed.';
}

export async function printWithBarTender(labels: MoLabel[]): Promise<BarTenderPrintResult> {
  const { config, missing } = readConfig();
  if (!config) {
    throw new BarTenderConfigurationError(
      `BarTender printing is not configured: ${missing.join(', ')}.`,
    );
  }

  const { xml, labelCount } = buildBarTenderXml(
    labels,
    config.templatePath,
    config.printerName,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/xml, text/xml, */*',
      'Content-Type': 'application/xml; charset=utf-8',
    };
    if (config.username && config.password) {
      headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    }

    const response = await fetch(config.integrationUrl, {
      method: 'POST',
      headers,
      body: xml,
      signal: controller.signal,
    });
    const responseBody = await response.text();

    if (!response.ok) {
      const details = responseBody.trim().slice(0, 1_000);
      throw new BarTenderIntegrationError(
        `BarTender integration rejected the request (${response.status})${details ? `: ${details}` : '.'}`,
      );
    }

    const printError = responseError(responseBody);
    if (printError) throw new BarTenderIntegrationError(printError);

    return {
      status: 'queued',
      labelsQueued: labelCount,
      mosSubmitted: labels.length,
      printerName: config.printerName,
    };
  } catch (error) {
    if (error instanceof BarTenderIntegrationError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BarTenderIntegrationError(
        `Timed out contacting the Receiving-station BarTender integration after ${config.timeoutMs} ms.`,
      );
    }
    throw new BarTenderIntegrationError(
      `Could not contact the Receiving-station BarTender integration: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
