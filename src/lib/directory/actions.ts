"use server"

import { createClient } from "@/lib/supabase/server"
import {
  attachContacts,
  attachEducation,
  buildDirectoryProfilesQuery,
  DIRECTORY_PAGE_SIZE,
} from "./queries"
import type { DirectoryMember } from "./types"

export type LoadMoreDirectoryFilters = {
  tab: string
  personas: string[]
  school: string
  field: string
  tags: string[]
}

export async function loadMoreDirectoryMembers(
  offset: number,
  filters: LoadMoreDirectoryFilters,
): Promise<{ members: DirectoryMember[]; hasMore: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { members: [], hasMore: false }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school")
    .eq("id", user.id)
    .single()

  const { data: members, count } = await buildDirectoryProfilesQuery(supabase, {
    ...filters,
    userSchool: profile?.school ?? null,
  }).range(offset, offset + DIRECTORY_PAGE_SIZE - 1)

  // "Load more" only ever runs when there's no active free-text search (the
  // search box switches to a full server refetch instead), so no fuzzy match
  // is needed here — just the same server-side filters as the initial page.
  const withEducation = await attachEducation(supabase, (members ?? []) as DirectoryMember[])
  const withContacts = await attachContacts(supabase, withEducation)

  return {
    members: withContacts,
    hasMore: offset + DIRECTORY_PAGE_SIZE < (count ?? 0),
  }
}
