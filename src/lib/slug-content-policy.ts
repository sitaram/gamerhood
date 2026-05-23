/**
 * Terms not allowed in public shop URL slugs (hyphen-separated segments).
 * Keep lowercase; matching is case-insensitive. Extend as needed.
 */
export const BLOCKED_SLUG_TERMS = new Set([
  // Slurs / hate (non-exhaustive)
  "fag",
  "faggot",
  "nazi",
  "retard",
  "spic",
  "chink",
  "coon",
  "dyke",
  "kike",
  "wetback",
  // Profanity / insults
  "arse",
  "ass",
  "asshole",
  "ballsack",
  "bastard",
  "bitch",
  "bloody",
  "blowjob",
  "bollocks",
  "boner",
  "boob",
  "bullshit",
  "crap",
  "cum",
  "cunt",
  "damn",
  "dick",
  "dildo",
  "jerk",
  "milf",
  "motherfucker",
  "penis",
  "piss",
  "pissed",
  "prick",
  "pussy",
  "rape",
  "rapist",
  "scrotum",
  "shit",
  "shitty",
  "slut",
  "tits",
  "titty",
  "tosser",
  "twat",
  "vagina",
  "wank",
  "whore",
  // Sexual / adult
  "anal",
  "bdsm",
  "blow",
  "bondage",
  "boobs",
  "breasts",
  "clit",
  "cock",
  "creampie",
  "cumshot",
  "cunnilingus",
  "deepthroat",
  "doggystyle",
  "dominatrix",
  "ejaculate",
  "erotic",
  "escort",
  "fetish",
  "fisting",
  "fuckme",
  "gangbang",
  "hentai",
  "hooker",
  "horny",
  "incest",
  "jizz",
  "kink",
  "lewd",
  "lingerie",
  "masturbate",
  "naked",
  "nude",
  "nsfw",
  "nudes",
  "onlyfans",
  "orgasm",
  "pedo",
  "pedophile",
  "porn",
  "porno",
  "pornhub",
  "pornographic",
  "prostitute",
  "pussies",
  "rapey",
  "rimjob",
  "sexdoll",
  "sexual",
  "sexy",
  "slutty",
  "snuff",
  "sperm",
  "strapon",
  "threesome",
  "titfuck",
  "vibrator",
  "virgin",
  "voyeur",
  "xxx",
  "xvideos",
  "youporn",
]);

/** Replace common leetspeak so `p0rn` is treated like `porn`. */
function normalizeLeet(s: string): string {
  return s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/!/g, "i");
}

/**
 * Returns an error message if the slug (already lowercase, valid charset) contains blocked language.
 */
export function blockedSlugLanguageReason(slug: string): string | null {
  const segments = slug.split("-").filter(Boolean);

  for (const segment of segments) {
    const norm = normalizeLeet(segment);
    const alphaOnly = norm.replace(/\d/g, "");

    for (const term of BLOCKED_SLUG_TERMS) {
      if (term.length <= 3) {
        if (segment === term || norm === term || alphaOnly === term) {
          return "That shop URL contains language that isn’t allowed. Please choose another.";
        }
      } else {
        if (segment === term || norm === term) {
          return "That shop URL contains language that isn’t allowed. Please choose another.";
        }
        if (norm.includes(term) || alphaOnly.includes(term)) {
          return "That shop URL contains language that isn’t allowed. Please choose another.";
        }
      }
    }
  }

  const joined = slug.replace(/-/g, "");
  const joinedNorm = normalizeLeet(joined);
  for (const term of BLOCKED_SLUG_TERMS) {
    if (term.length < 4) continue;
    if (joinedNorm.includes(term)) {
      return "That shop URL contains language that isn’t allowed. Please choose another.";
    }
  }

  return null;
}
