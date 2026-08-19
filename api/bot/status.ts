export default async function handler(req: any, res: any) {
  try {
    const { getOverviewAnalytics } = await import('../_db.js');
    const overview = await getOverviewAnalytics();
    res.status(200).json({
      mode: 'serverless',
      discordConnected: false,
      botTag: null,
      guildCount: 0,
      activeVoiceCount: overview.activeVoiceCount,
      activeVideoCount: overview.activeVideoCount,
      activeStreamCount: overview.activeStreamCount,
      totalLoggedSessions: overview.totalSessionsCount,
      totalTrackedMembers: overview.totalGuildMembersCount,
      uptimeSeconds: null,
      alertChannelName: '#stream-announcements',
      inactiveThresholdDays: 7,
      autoAlertStream: true,
      autoAlertVideo: true,
    });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || 'Failed to load bot status',
      stack: e?.stack,
    });
  }
}
