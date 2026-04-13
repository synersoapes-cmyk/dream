export function getSimulatorDisplayImageUrl(imageUrl?: string) {
  if (!imageUrl) {
    return undefined;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    try {
      const url = new URL(imageUrl);
      if (url.hostname.endsWith('.r2.cloudflarestorage.com')) {
        return `/api/proxy/file?url=${encodeURIComponent(imageUrl)}`;
      }
    } catch {
      return imageUrl;
    }

    return imageUrl;
  }

  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }

  return `/api/proxy/file?key=${encodeURIComponent(imageUrl)}`;
}
