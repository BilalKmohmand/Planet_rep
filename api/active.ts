import { db } from '../server/db';

export default async function handler(req: any, res: any) {
  try {
    const active = await db.getAllActiveStates();
    res.status(200).json({ active });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load active states' });
  }
}
