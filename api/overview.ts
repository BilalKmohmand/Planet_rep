export default async function handler(req: any, res: any) {
  try {
    const { getOverviewAnalytics } = await import('./_db.js');
    const data = await getOverviewAnalytics();
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || 'Failed to load overview',
      stack: e?.stack,
    });
  }
}
