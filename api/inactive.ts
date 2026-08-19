import { db } from '../server/db';

export default async function handler(req: any, res: any) {
  try {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 7;
    const report = await db.getInactiveMembers(days);
    res.status(200).json(report);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load inactive members' });
  }
}
