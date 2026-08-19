export default async function handler(req: any, res: any) {
  try {
    const { getAlertLogs } = await import('./_db.js');
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const logs = await getAlertLogs(limit);
    res.status(200).json({ logs });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || 'Failed to load alerts',
      stack: e?.stack,
    });
  }
}
