export async function persistNewsletters(supabase, payloads) {
  const { data: existing, error: readError } = await supabase.from("resources")
    .select("slug, image_url, thumbnail_url, image_alt").eq("resource_type", "newsletter")
  if (readError) throw new Error(readError.message)
  const rows = payloads.map((payload, index) => {
    const previous = existing?.find(row => row.slug === payload.slug)
    return { ...payload, featured: index === 0,
      // Preserve curated covers; a missing feed image never erases artwork.
      image_url: previous?.image_url || payload.image_url || null,
      thumbnail_url: previous?.thumbnail_url || payload.thumbnail_url || null,
      image_alt: previous?.image_alt || payload.image_alt || null,
    }
  })
  const { error } = await supabase.from("resources").upsert(rows, { onConflict: "slug" })
  if (error) throw new Error(error.message)
  const { error: featureError } = await supabase.from("resources")
    .update({ featured: false }).eq("resource_type", "newsletter").neq("slug", rows[0].slug)
  if (featureError) throw new Error(featureError.message)
  // Confirm persistence rather than treating a queued request as completion.
  const { data: saved, error: verifyError } = await supabase.from("resources")
    .select("slug, url").eq("status", "published").in("slug", rows.map(row => row.slug))
  if (verifyError) throw new Error(verifyError.message)
  if (!rows.every(row => saved?.some(item => item.slug === row.slug && item.url === row.url))) {
    throw new Error("Newsletter import verification failed")
  }
  return { status: "synced", count: rows.length, latest: rows[0].slug }
}
