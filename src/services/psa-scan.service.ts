/**
 * PSA Scan Service — fetches scan images from PSA's cert pages.
 *
 * Every PSA cert has a deterministic URL:
 *   https://www.psacard.com/cert/{certNumber}/psa
 *
 * This eliminates the need for R2 image uploads or presigned URLs.
 */

const PSA_CERT_BASE_URL = "https://www.psacard.com/cert";

/**
 * Returns the PSA cert page URL for a given cert number.
 * Pure string construction — no API call needed.
 */
export function getPsaScanUrl(certNumber: string): string {
  return `${PSA_CERT_BASE_URL}/${certNumber}/psa`;
}

/**
 * Fetches the PSA cert page and extracts the front/back scan image URLs.
 * These are embedded <img> tags on the cert page.
 *
 * Returns null URLs if the cert page has no scans (very old certs).
 */
export async function getPsaScanImageUrls(
  certNumber: string,
): Promise<{ front?: string; back?: string }> {
  try {
    const certPageUrl = getPsaScanUrl(certNumber);
    const response = await fetch(certPageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Cardboard/1.0)",
      },
    });

    if (!response.ok) {
      return {};
    }

    const html = await response.text();

    // PSA cert pages embed scan images with specific patterns.
    // The front/back images are typically in <img> tags with cert-related src attributes.
    const front = extractImageUrl(html, "front") ?? extractImageUrl(html, "obverse");
    const back = extractImageUrl(html, "back") ?? extractImageUrl(html, "reverse");

    // Fallback: look for any cert image URLs in the page
    if (!front && !back) {
      const genericImages = extractAllCertImages(html);
      return {
        front: genericImages[0],
        back: genericImages[1],
      };
    }

    return { front: front ?? undefined, back: back ?? undefined };
  } catch {
    // Network error or timeout — return empty
    return {};
  }
}

/**
 * Extract an image URL from HTML matching a keyword (e.g. "front", "back").
 */
function extractImageUrl(html: string, keyword: string): string | null {
  // Look for img tags where src or alt contains the keyword
  const imgRegex = new RegExp(
    `<img[^>]*(?:src|data-src)=["']([^"']+)[^>]*(?:alt|class|id)=[^>]*${keyword}[^>]*>`,
    "i",
  );
  const match = html.match(imgRegex);
  if (match?.[1]) return normalizeImageUrl(match[1]);

  // Also check reversed order (alt before src)
  const altFirstRegex = new RegExp(
    `<img[^>]*(?:alt|class|id)=[^>]*${keyword}[^>]*(?:src|data-src)=["']([^"']+)[^>]*>`,
    "i",
  );
  const altMatch = html.match(altFirstRegex);
  if (altMatch?.[1]) return normalizeImageUrl(altMatch[1]);

  return null;
}

/**
 * Extract all cert-related image URLs from the page as a fallback.
 */
function extractAllCertImages(html: string): string[] {
  const urls: string[] = [];

  // Match image URLs that look like PSA cert scans
  const imgRegex = /<img[^>]*(?:src|data-src)=["']([^"']*(?:cert|scan|card|image)[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) urls.push(normalizeImageUrl(match[1]));
  }

  return urls;
}

/**
 * Normalize a potentially relative image URL to absolute.
 */
function normalizeImageUrl(url: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://www.psacard.com${url.startsWith("/") ? "" : "/"}${url}`;
}
