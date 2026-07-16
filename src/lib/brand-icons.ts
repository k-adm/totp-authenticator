// Curated brand icons for popular services, from simple-icons (CC0).
// Named imports tree-shake, so only these icons land in the bundle.
import {
  si1password,
  siApple,
  siAsana,
  siAtlassian,
  siAuth0,
  siBinance,
  siBitbucket,
  siBitwarden,
  siClickup,
  siCloudflare,
  siCoinbase,
  siConfluence,
  siDashlane,
  siDigitalocean,
  siDiscord,
  siDocker,
  siDropbox,
  siEa,
  siEbay,
  siEpicgames,
  siExpressvpn,
  siFacebook,
  siFastly,
  siFigma,
  siGitea,
  siGithub,
  siGitlab,
  siGmail,
  siGodaddy,
  siGoogle,
  siGoogleplay,
  siHetzner,
  siHubspot,
  siInstagram,
  siJira,
  siKeeper,
  siKucoin,
  siLastpass,
  siMailchimp,
  siMastodon,
  siMeta,
  siMullvad,
  siNamecheap,
  siNetflix,
  siNetlify,
  siNordvpn,
  siNotion,
  siNpm,
  siOkta,
  siOvh,
  siPatreon,
  siPaypal,
  siPinterest,
  siPlex,
  siProton,
  siProtondrive,
  siProtonmail,
  siProtonvpn,
  siReddit,
  siRevolut,
  siRobinhood,
  siShopify,
  siSignal,
  siSnapchat,
  siSpotify,
  siStackoverflow,
  siSteam,
  siStripe,
  siTelegram,
  siTiktok,
  siTrello,
  siTumblr,
  siTuta,
  siTwitch,
  siUbisoft,
  siVercel,
  siWhatsapp,
  siWikipedia,
  siWise,
  siWordpress,
  siX,
  siYubico,
  siZendesk,
  siZoho,
  siZoom,
} from "simple-icons";

export interface BrandIcon {
  path: string;
  hex: string; // 6-digit, no '#'
  title: string;
}

function icon(si: { path: string; hex: string; title: string }): BrandIcon {
  return { path: si.path, hex: si.hex, title: si.title };
}

// Normalized service key -> brand icon. Keys are lowercase alphanumerics only.
const MAP: Record<string, BrandIcon> = {
  github: icon(siGithub),
  gitlab: icon(siGitlab),
  gitea: icon(siGitea),
  bitbucket: icon(siBitbucket),
  google: icon(siGoogle),
  gmail: icon(siGmail),
  googleplay: icon(siGoogleplay),
  apple: icon(siApple),
  appleid: icon(siApple),
  icloud: icon(siApple),
  facebook: icon(siFacebook),
  meta: icon(siMeta),
  instagram: icon(siInstagram),
  x: icon(siX),
  twitter: icon(siX),
  reddit: icon(siReddit),
  discord: icon(siDiscord),
  telegram: icon(siTelegram),
  whatsapp: icon(siWhatsapp),
  signal: icon(siSignal),
  mastodon: icon(siMastodon),
  tumblr: icon(siTumblr),
  pinterest: icon(siPinterest),
  snapchat: icon(siSnapchat),
  tiktok: icon(siTiktok),
  dropbox: icon(siDropbox),
  steam: icon(siSteam),
  twitch: icon(siTwitch),
  epicgames: icon(siEpicgames),
  epic: icon(siEpicgames),
  ea: icon(siEa),
  electronicarts: icon(siEa),
  ubisoft: icon(siUbisoft),
  paypal: icon(siPaypal),
  stripe: icon(siStripe),
  coinbase: icon(siCoinbase),
  binance: icon(siBinance),
  kucoin: icon(siKucoin),
  wise: icon(siWise),
  transferwise: icon(siWise),
  revolut: icon(siRevolut),
  robinhood: icon(siRobinhood),
  cloudflare: icon(siCloudflare),
  digitalocean: icon(siDigitalocean),
  vercel: icon(siVercel),
  netlify: icon(siNetlify),
  ovh: icon(siOvh),
  hetzner: icon(siHetzner),
  fastly: icon(siFastly),
  npm: icon(siNpm),
  docker: icon(siDocker),
  notion: icon(siNotion),
  figma: icon(siFigma),
  atlassian: icon(siAtlassian),
  jira: icon(siJira),
  confluence: icon(siConfluence),
  zoom: icon(siZoom),
  wordpress: icon(siWordpress),
  shopify: icon(siShopify),
  proton: icon(siProton),
  protonmail: icon(siProtonmail),
  protonvpn: icon(siProtonvpn),
  protondrive: icon(siProtondrive),
  bitwarden: icon(siBitwarden),
  onepassword: icon(si1password),
  "1password": icon(si1password),
  lastpass: icon(siLastpass),
  dashlane: icon(siDashlane),
  keeper: icon(siKeeper),
  yubico: icon(siYubico),
  yubikey: icon(siYubico),
  okta: icon(siOkta),
  auth0: icon(siAuth0),
  namecheap: icon(siNamecheap),
  godaddy: icon(siGodaddy),
  mailchimp: icon(siMailchimp),
  trello: icon(siTrello),
  asana: icon(siAsana),
  clickup: icon(siClickup),
  hubspot: icon(siHubspot),
  zendesk: icon(siZendesk),
  nordvpn: icon(siNordvpn),
  expressvpn: icon(siExpressvpn),
  mullvad: icon(siMullvad),
  zoho: icon(siZoho),
  tuta: icon(siTuta),
  tutanota: icon(siTuta),
  patreon: icon(siPatreon),
  plex: icon(siPlex),
  spotify: icon(siSpotify),
  netflix: icon(siNetflix),
  ebay: icon(siEbay),
  stackoverflow: icon(siStackoverflow),
  wikipedia: icon(siWikipedia),
};

function normalize(value: string): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Resolve a brand icon for an account by issuer/label, or null for the fallback avatar. */
export function resolveBrandIcon(
  issuer?: string,
  label?: string,
): BrandIcon | null {
  for (const candidate of [issuer, label]) {
    if (!candidate) continue;
    // Whole-string match first (e.g. "onepassword").
    const n = normalize(candidate);
    if (n && MAP[n]) return MAP[n];
    // Then exact per-token (word-boundary) match. This matches "GitHub Inc."
    // -> "github" and "Google One Pro" -> "google" without the prefix
    // false-positives of startsWith (e.g. "Metabase" must NOT match "meta").
    for (const token of candidate.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token && MAP[token]) return MAP[token];
    }
  }
  return null;
}

/** Perceived luminance (0..255) of a 6-digit hex; used to pick glyph contrast. */
export function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
