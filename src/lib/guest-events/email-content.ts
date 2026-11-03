import { buildGoogleCalendarUrl, formatEventDateTime } from "../events/calendar"
import type { EventRecord } from "../events/types"
import type { GuestEmailKind, GuestRegistration } from "./domain"
import { safeWebUrl } from "./domain"

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
export function renderGuestEmail({ kind, event, guest, site, token }: {
  kind: GuestEmailKind; event: EventRecord; guest: GuestRegistration; site: string; token: string
}) {
  const manageUrl = site + "/events/rsvp/" + encodeURIComponent(token)
  const join = safeWebUrl(event.join_url)
  const date = formatEventDateTime(event.starts_at, event.ends_at, event.timezone)
  const invitation = kind === "membership_invitation"
  const title = invitation ? "Keep connecting with IPN" : kind === "rsvp_confirmation" ? "Your RSVP is confirmed!"
    : kind === "reminder_24h" ? "Your IPN event is tomorrow" : "Your IPN event starts soon"
  const subject = invitation ? "Your next step with IPN" : (kind === "rsvp_confirmation" ? "RSVP confirmed: " : kind === "reminder_24h" ? "Tomorrow: " : "Starting soon: ") + event.title
  const body = invitation
    ? ["Meet students and early-career professionals, discover upcoming events, and explore the IPN community.", "IPN membership is free. Create an account whenever you’re ready."]
    : [kind === "rsvp_confirmation" ? "You’re registered. You do not need an IPN account to attend." : "Here are your joining details. No portal login is needed.",
      ...(!join ? ["Joining details are not available yet. Use your event access page below for the latest information."] : [])]
  const links = invitation
    ? [{ label: "Join IPN free", href: site + "/register" }]
    : [
      { label: join ? "Join event" : "View joining details", href: join ?? manageUrl },
      { label: "Add to calendar", href: buildGoogleCalendarUrl({ ...event, join_url: join }) },
    ]
  const details = invitation ? [] : [event.title, date, event.location_label ?? "Online", ...(event.speakers ? ["Speaker: " + event.speakers] : [])]
  const footer = invitation ? "You asked for an invitation to join IPN after this event." : "You’re receiving this because you RSVP’d for this IPN event."
  const unsubscribe = site + "/events/rsvp/" + encodeURIComponent(token) + "?action=unsubscribe"
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#3f3f46"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 12px" align="center"><table role="presentation" width="100%" style="max-width:600px;background:white;border:1px solid #e4e4e7;border-radius:12px"><tr><td style="padding:28px">
  <p style="color:#664fa1;font-size:14px;font-weight:600">IPN Events</p>
  <p>Hi ${escapeHtml(guest.first_name)},</p><h1 style="font-size:24px;color:#18181b">${escapeHtml(title)}</h1>
  ${body.map(p => '<p style="line-height:1.6">' + escapeHtml(p) + '</p>').join("")}
  ${details.map(p => '<p style="margin:8px 0;line-height:1.5">' + escapeHtml(p) + '</p>').join("")}
  <div style="margin:24px 0">${links.map((l,i) => '<p><a href="' + escapeHtml(l.href) + '" style="' + (i === 0 ? 'display:inline-block;padding:12px 18px;background:#664fa1;color:white;border-radius:8px;text-decoration:none;font-weight:600' : 'color:#664fa1') + '">' + escapeHtml(l.label) + '</a></p>').join("")}</div>
  ${!invitation ? '<p><a style="color:#664fa1" href="' + escapeHtml(manageUrl) + '">View or cancel your RSVP</a></p>' : ""}
  <p style="font-size:12px;color:#71717a;line-height:1.5">${escapeHtml(footer)} ${invitation ? '<a href="' + escapeHtml(unsubscribe) + '">Unsubscribe</a>' : ""}</p>
  </td></tr></table></td></tr></table></body></html>`
  const text = [title, "Hi " + guest.first_name + ",", ...body, ...details, ...links.map(l => l.label + ": " + l.href), !invitation ? "View or cancel RSVP: " + manageUrl : "Unsubscribe: " + unsubscribe, footer].join("\n\n")
  return { subject, html, text, ...(invitation ? { headers: { "List-Unsubscribe": "<" + site + "/api/events/guest-preferences?token=" + encodeURIComponent(token) + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) }
}
