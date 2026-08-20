export default async function handler(req: any, res: any) {
  try {
    const { getOverviewAnalytics, getAlertLogs } = await import('./_db.js');

    const [overview, logs] = await Promise.all([
      getOverviewAnalytics(),
      getAlertLogs(25),
    ]);

    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=10');
    res.status(200).json({
      status: {
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
      },
      overview,
      channels: { channels: overview.channels || [] },
      alerts: { logs },
    });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || 'Failed to load bootstrap data',
      stack: e?.stack,
    });
  }
}
