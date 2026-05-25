export const BACKGROUND_OPTIONS = [
  "High school / pre-college",
  "Undergraduate student",
  "Graduate student (Master's or PhD)",
  "Professional degree student (MD, JD, MBA, etc.)",
  "Professional in psychedelics",
  "Professional in another field",
  "Other",
] as const

export const STUDENT_BACKGROUNDS = new Set([
  "Undergraduate student",
  "Graduate student (Master's or PhD)",
  "Professional degree student (MD, JD, MBA, etc.)",
])

export const PROFESSIONAL_BACKGROUNDS = new Set([
  "Professional in psychedelics",
  "Professional in another field",
  "Other",
])

export const FIELD_OPTIONS = [
  "Arts & Humanities",
  "Business",
  "Health & Medicine",
  "Law & Policy",
  "Multi-Disciplinary",
  "Public & Social Services",
  "Science, Technology, Engineering, Mathematics (STEM)",
  "Social Sciences",
  "Skilled Trades & Personal Services",
  "Education",
  "Media, Journalism & Communications",
] as const

export const FIELD_STATUS_OPTIONS = [
  "Yes — I currently work in the field",
  "No — I don't plan to work in the field",
  "Not yet — I'm interested in working in the field",
  "I'm not sure",
] as const

export const BARRIER_OPTIONS = [
  "I'm still a student but plan to work in the field after graduation",
  "I'm unsure what kind of work I want to do in the field",
  "I haven't found the right opportunity yet",
  "I'm not ready to commit to this field",
  "I'm interested but feel underqualified",
  "I'm working in a related field for now",
  "Other",
] as const

export const INTEREST_TAG_OPTIONS = [
  "Addiction",
  "Advocacy",
  "Anthropology",
  "Anxiety",
  "Ayahuasca",
  "Ceremony",
  "Chronic Pain",
  "Clinic Operations",
  "Clinical Trials",
  "Communications",
  "Compliance",
  "Consciousness",
  "Couples Therapy",
  "Data Science",
  "Depression",
  "DMT",
  "Drug Policy Reform",
  "Eating Disorders",
  "Education & Training",
  "Ethics",
  "Ethnobotany",
  "Facilitation",
  "Group Therapy",
  "Harm Reduction",
  "Ibogaine",
  "Indigenous Practices",
  "Integration Coaching",
  "Journalism",
  "Ketamine",
  "LSD",
  "MDMA",
  "Media",
  "Mescaline",
  "Microdosing",
  "Mystical & Spiritual Experience",
  "Neuroscience",
  "OCD",
  "Palliative Care",
  "Peer Support",
  "Pharmaceutical Development",
  "Pharmacology",
  "Philosophy",
  "Psilocybin",
  "Psychiatry",
  "Psychopharmacology",
  "PTSD",
  "Regulatory Affairs",
  "Retreats",
  "Somatic Work",
  "Startup & Entrepreneurship",
  "Translational Research",
] as const

export const REFERRAL_OPTIONS = [
  "Social Media",
  "Friend / Colleague",
  "Google / Search Engine",
  "Email / Newsletter",
  "Event / Conference",
  "Academic / Professional Organization",
] as const

export const STEPS = [
  "Account",
  "Location",
  "Background",
  "About You",
] as const
