import { Router } from 'express';
import { getMorningLabels } from '../services/labelsService';
import {
  BarTenderConfigurationError,
  BarTenderIntegrationError,
  BarTenderRequestError,
  getBarTenderStatus,
  printWithBarTender,
  validatePrintLabels,
} from '../services/bartenderService';

export const labelsRouter = Router();

/**
 * GET /api/labels/morning?date=YYYY-MM-DD
 *
 * Open MOs created that day (ScheduleDB.dbo.OpenMO) with Type N BOM components.
 * Point Use filter is deferred.
 */
labelsRouter.get('/morning', async (req, res) => {
  try {
    const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined;
    const payload = await getMorningLabels(dateParam);
    res.json(payload);
  } catch (error) {
    console.error('Error loading morning labels:', error);
    res.status(500).json({
      error: 'Failed to load morning labels',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/labels/print-status
 *
 * Reports whether shock has enough configuration to submit BTXML to the
 * Receiving workstation's native BarTender Integration Service.
 */
labelsRouter.get('/print-status', (_req, res) => {
  res.json(getBarTenderStatus());
});

/**
 * POST /api/labels/print
 *
 * Builds one BTXML Print command per physical label and sends the batch to
 * the Receiving workstation. BarTender renders RecievingFormat.btw and spools
 * it to the printer installed on that workstation.
 */
labelsRouter.post('/print', async (req, res) => {
  try {
    const labels = validatePrintLabels(req.body?.labels);
    const result = await printWithBarTender(labels);
    res.json(result);
  } catch (error) {
    if (error instanceof BarTenderRequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof BarTenderConfigurationError) {
      res.status(503).json({ error: error.message });
      return;
    }
    if (error instanceof BarTenderIntegrationError) {
      console.error('BarTender integration error:', error.message);
      res.status(502).json({ error: error.message });
      return;
    }

    console.error('Unexpected BarTender printing error:', error);
    res.status(500).json({ error: 'Unexpected BarTender printing error.' });
  }
});
