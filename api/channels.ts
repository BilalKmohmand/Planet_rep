import { db } from '../server/db';

export default async function handler(req: any, res: any) {
  try {
    const channels = await db.getChannels();
    res.status(200).json({ channels });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load channels' });
  }
}
