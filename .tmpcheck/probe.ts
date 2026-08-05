import type { DB } from "../src/lib/db/kysely";

type PostsKeys = keyof DB["posts"];
type PlaylistPostsKeys = keyof DB["playlist_posts"];
type PlaylistKeys = keyof DB["playlists"];

// @ts-expect-error - probe: does thumbnailKey exist?
const a: "thumbnailKey" = null as unknown as PostsKeys;
// @ts-expect-error - probe: does thumbnail_key exist?
const b: "thumbnail_key" = null as unknown as PostsKeys;
// @ts-expect-error - probe: does playlistId exist?
const c: "playlistId" = null as unknown as PlaylistPostsKeys;
// @ts-expect-error - probe: does playlist_id exist?
const d: "playlist_id" = null as unknown as PlaylistPostsKeys;

console.log("ok");
