export default async function handler(req: any, res: any) {
  try {
    const { getAllActiveStates } = await import('./_db.js');
    const active = await getAllActiveStates();
    res.status(200).json({ active });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || 'Failed to load active states',
      stack: e?.stack,
    });
  }
}
