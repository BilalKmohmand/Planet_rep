export default async function handler(req: any, res: any) {
  try {
    const { getUserStats } = await import('../_db.js');
    const userIdParam = req.query.userId;
    if (!userIdParam || Array.isArray(userIdParam)) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const timeframe = (req.query.timeframe as any) || 'all';
    const stats = await getUserStats(String(userIdParam), timeframe);
    res.status(200).json(stats);
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || 'Failed to load user stats',
      stack: e?.stack,
    });
  }
}
