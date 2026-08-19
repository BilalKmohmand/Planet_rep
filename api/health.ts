export default function handler(req: any, res: any) {
  const hasSupabaseUrl = !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasSupabaseKey = !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  res.status(200).json({
    status: 'ok',
    time: Date.now(),
    env: {
      hasSupabaseUrl,
      hasSupabaseKey,
      hasDiscordBotToken: !!process.env.DISCORD_BOT_TOKEN,
    },
  });
}
