import { db } from '../server/db';

export default async function handler(req: any, res: any) {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const logs = await db.getAlertLogs(limit);
    res.status(200).json({ logs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load alerts' });
  }
}
