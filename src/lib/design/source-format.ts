/** True when a browser FileReader data URL came from an SVG upload. */
export function isSvgDataUrl(url: string): boolean {
  if (!url.startsWith("data:")) return false;
  const semi = url.indexOf(";");
  const comma = url.indexOf(",");
  const end = semi === -1 ? comma : semi;
  if (end <= 5) return false;
  return url.slice(5, end).trim().toLowerCase() === "image/svg+xml";
}
