export function mergeInstagramSnapshot(previousSocial, media) {
  const byId = new Map((previousSocial.instagramPosts ?? []).map((post) => [post.id, post]))
  const previousAccount = previousSocial.instagramArchive?.accountId
  if (previousAccount && media.account_id && previousAccount !== String(media.account_id)) {
    throw new Error("Instagram snapshot account mismatch; refusing to mix archives")
  }
  for (const post of media.posts ?? []) {
    if (!post.id || !post.timestamp || !Number.isFinite(Date.parse(post.timestamp))) {
      throw new Error("Invalid Instagram archive post")
    }
    byId.set(String(post.id), {
      id: String(post.id), date: post.timestamp,
      type: post.media_type || post.media_product_type || "", caption: post.caption || "",
      likes: Number(post.like_count) || 0, comments: Number(post.comments_count) || 0,
      engagement: (Number(post.like_count) || 0) + (Number(post.comments_count) || 0),
      permalink: post.permalink || "", lastObservedAt: post.last_observed_at || media.pulled_at || null,
    })
  }
  const instagramPosts = [...byId.values()].sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""))
  return {
    instagramPosts,
    instagramArchive: {
      accountId: media.account_id ? String(media.account_id) : previousAccount ?? null,
      backfillComplete: media.backfill_complete ?? previousSocial.instagramArchive?.backfillComplete ?? false,
      backfilledAt: media.backfilled_at ?? previousSocial.instagramArchive?.backfilledAt ?? null,
      oldestPostAt: instagramPosts.at(-1)?.date ?? null,
    },
  }
}

export function buildInstagramArchiveSnapshot(previous, { media, pull, stats }, generatedAt = new Date().toISOString()) {
  if (pull.status !== "success" || String(media.account_id) !== String(stats.account_id)
      || media.pulled_at !== stats.pulled_at || pull.last_pull !== stats.pulled_at) {
    throw new Error("Instagram pull must succeed for the same account and timestamp before publishing a candidate")
  }
  const snapshot = structuredClone(previous)
  snapshot.social = { ...snapshot.social, ...mergeInstagramSnapshot(snapshot.social, media) }
  const platform = snapshot.social.platforms.find((item) => item.id === "instagram")
  if (platform) Object.assign(platform, { followers: stats.followers_count, updatedAt: stats.pulled_at,
    engagementRate: stats.avg_engagement_rate_30d,
    postsThisMonth: snapshot.social.instagramPosts.filter((post) => new Date(post.date).toISOString().slice(0, 7) === stats.pulled_at.slice(0, 7)
      && Date.parse(post.date) <= Date.parse(stats.pulled_at)).length })
  const source = snapshot.dataSources.find((item) => item.id === "instagram")
  if (source) Object.assign(source, { status: "success", lastPull: stats.pulled_at, lastSuccessfulAt: stats.pulled_at,
    lastAttemptedAt: stats.pulled_at, note: `${stats.followers_count} followers` })
  snapshot.generatedAt = generatedAt
  return snapshot
}
