import { getAllActiveStates } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    const active = await getAllActiveStates();
    res.status(200).json({ active });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load active states' });
  }
}
