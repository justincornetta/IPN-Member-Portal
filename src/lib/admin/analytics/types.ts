export type AnalyticsPoint = {
  label: string
  value: number
}

export type AnalyticsKpi = {
  label: string
  value: number
  helper: string
}

export type AnalyticsSourceStatus = "live" | "basic" | "manual" | "pending" | "snapshot" | string

export type AnalyticsDataSource = {
  id: string
  label: string
  status: AnalyticsSourceStatus
  mode: string
  lastPull: string | null
  note: string
}

export type LegacyAnalyticsSnapshot = {
  generatedAt: string
  dashboardRepo: string
  dataSources: AnalyticsDataSource[]
  overview: {
    kpis: AnalyticsKpi[]
    channelHealth: {
      channel: string
      status: "active" | "watch" | "pending" | string
      metric: number | null
      note: string
    }[]
    insights: string[]
  }
  members: {
    totals: {
      rowCount: number
      inForm: number
      inMailchimp: number
      inOldApp: number
      inEventbrite: number
      inZoom: number
      pulledAt: string | null
      builtAt: string | null
    }
    sourceTotals: (AnalyticsPoint & { id: string })[]
    sourceCombinations: AnalyticsPoint[]
    growth: { month: string; newMembers: number; cumulative: number }[]
    countries: AnalyticsPoint[]
    states: AnalyticsPoint[]
    selfDescription: AnalyticsPoint[]
    primaryField: AnalyticsPoint[]
    workStatus: AnalyticsPoint[]
    referralSource: AnalyticsPoint[]
    engagementStatus: AnalyticsPoint[]
    demographics: Record<string, { total: number; answered: number; items: AnalyticsPoint[] }>
    formRows: {
      id: string
      date: string | null
      firstName: string
      lastName: string
      email: string
      affiliation: string
      country: string
      field: string
      describes: string
      heard: string
    }[]
  }
  marketing: {
    summary: {
      totalSubscribers: number
      totalLists: number
      totalCampaigns: number
      avgOpenRate: number
      avgClickRate: number
      totalUnsubscribes: number
      pulledAt: string | null
    }
    lists: {
      id: string
      name: string
      members: number
      unsubscribeCount: number
      openRate: number
      clickRate: number
    }[]
    monthly: {
      month: string
      campaigns: number
      sent: number
      opens: number
      clicks: number
      unsubscribes: number
      openRate: number
      clickRate: number
    }[]
    growth: {
      listName: string
      month: string
      members: number
      newMembers: number
    }[]
    campaigns: {
      id: string
      title: string
      subject: string
      date: string | null
      listName: string
      sent: number
      opens: number
      openRate: number
      clicks: number
      clickRate: number
      unsubscribes: number
      clickDetail: { url: string; clicks: number; uniqueClicks?: number | null; percentOfClicks?: number | null }[]
    }[]
  }
  social: {
    platforms: {
      id: string
      label: string
      followers: number | null
      engagementRate: number | null
      postsThisMonth: number | null
      status: string
      updatedAt: string | null
    }[]
    history: {
      date: string | null
      month: string
      channel: string
      followers: number
      engagementRate: number
      posts: number
    }[]
    instagramPosts: {
      id: string
      date: string | null
      type: string
      caption: string
      likes: number
      comments: number
      engagement: number
      permalink: string
    }[]
  }
  website: {
    overview: Record<string, unknown>
    trend: {
      month: string
      sessions: number
      users: number
      pageviews: number
      bounceRate: number
      avgDuration: number
      newUsers: number
    }[]
    dailyTrend: {
      date: string | null
      sessions: number
      users: number
      pageviews: number
      bounceRate: number
      avgDuration: number
      newUsers: number
    }[]
    devices: { label: string; sessions: number; users: number }[]
    channels: { label: string; sessions: number; users: number }[]
    sources: { source: string; medium: string; sessions: number; users: number }[]
    countries: { label: string; sessions: number; users: number }[]
    cities: { label: string; sessions: number; users: number }[]
    pages: { path: string; title: string; pageviews: number; users: number; avgDuration: number; bounceRate: number }[]
    funnels: { path: string; pageviews: number; users: number; bounceRate: number; avgDuration: number }[]
    outboundClicks: { url: string; clicks: number }[]
    blog: { path: string; title: string; pageviews: number; users: number; avgDuration: number; bounceRate: number }[]
    pulledAt: string | null
  }
  events: {
    zoom: {
      stats: {
        totalEvents: number
        totalParticipants: number
        avgParticipants: number
        avgAttendanceRate: number
        avgRetentionPct: number
        avgDurationMin: number
        repeatRatePct: number
        uniqueAttendees: number
        pulledAt: string | null
      }
      byMonth: { month: string; events: number; participants: number; avgParticipants: number; retentionPct: number }[]
      topAttendees: { name: string; email: string; events: number; totalDurationMin: number; lastEventDate: string | null }[]
      events: {
        id: string
        topic: string
        date: string | null
        program: string
        type: string
        inclusionStatus?: "included" | "excluded" | "pending"
        inclusionNote?: string
        attendees: number
        registrants: number | null
        avgDuration: number
        retentionPct: number
        repeatPct: number
        participantEmails: string[]
        participants: { name: string; email: string; durationMin: number; eventsAttended: number }[]
        registrations: { name: string; email: string; registeredAt: string | null }[]
      }[]
    }
    eventbrite: {
      summary: {
        totalEvents: number
        ticketsSold: number
        grossRevenue: number
        activeEvents: number
        upcomingEvents: number
        pulledAt: string | null
      }
      events: {
        id: string
        name: string
        date: string | null
        status: string
        format: string
        url: string
        capacity: number
        tickets: number
        grossRevenue: number
        netRevenue: number
        checkIns: number
        attendanceRate: number
        ticketClasses: { name: string; price: number; sold: number; capacity: number }[]
        dailySales: { date: string; tickets: number; revenue: number }[]
      }[]
    }
  }
}
