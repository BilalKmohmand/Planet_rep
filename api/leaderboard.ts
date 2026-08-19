import { getLeaderboard } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const type = (req.query.type as any) || 'stream';
    const timeframe = (req.query.timeframe as any) || 'weekly';
    const leaderboard = await getLeaderboard(type, timeframe);
    res.status(200).json({ leaderboard, type, timeframe });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load leaderboard' });
  }
}
