import { db } from '../server/db';

export default async function handler(req: any, res: any) {
  try {
    const data = await db.getOverviewAnalytics();
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load overview' });
  }
}
