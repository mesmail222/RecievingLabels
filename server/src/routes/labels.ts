import { Router } from 'express';
import { getMorningLabels } from '../services/labelsService';

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
