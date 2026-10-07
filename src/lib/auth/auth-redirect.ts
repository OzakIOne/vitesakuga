const internalOrigin = "https://vitesakuga.invalid";
const allowedAuthRedirectPaths = new Set([
  "/",
  "/account",
  "/account/playlists",
  "/account/playlists/liked",
  "/upload",
]);
const controlCharacterPattern = /\p{Cc}/u;
const playlistDetailsPathPattern = /^\/account\/playlists\/[1-9]\d*$/;

export const getSafeAuthRedirectUrl = (redirectUrl: string | undefined) => {
  if (
    !redirectUrl ||
    !redirectUrl.startsWith("/") ||
    redirectUrl.startsWith("//") ||
    redirectUrl.includes("\\") ||
    controlCharacterPattern.test(redirectUrl)
  ) {
    return "/";
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redirectUrl, internalOrigin);
  } catch {
    return "/";
  }

  if (
    parsedUrl.origin !== internalOrigin ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    return "/";
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";
  if (
    !allowedAuthRedirectPaths.has(pathname) &&
    !playlistDetailsPathPattern.test(pathname)
  ) {
    return "/";
  }

  return pathname;
};
