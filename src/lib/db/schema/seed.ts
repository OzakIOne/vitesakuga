import { drizzle } from "drizzle-orm/node-postgres";
import { seed } from "drizzle-seed";
import { envServer } from "src/lib/env/server";
import { posts } from "./sakuga.schema";

async function main() {
  console.log("Seeding database...");
  const db = drizzle(envServer.DATABASE_URL);
  await seed(db, { posts }).refine((funcs) => ({
    posts: {
      columns: {
        thumbnailKey: funcs.default({
          defaultValue:
            "thumbnails/1ppCamW3OqaDSzOSLt7RFEeDfwRnewPw/30a3b4ff-524b-4efe-831a-ff671ad79eea.jpg",
        }),
        userId: funcs.default({
          defaultValue: "1ppCamW3OqaDSzOSLt7RFEeDfwRnewPw",
        }),
        videoKey: funcs.default({
          defaultValue:
            "videos/1ppCamW3OqaDSzOSLt7RFEeDfwRnewPw/30a3b4ff-524b-4efe-831a-ff671ad79eea.mp4",
        }),
      },
      count: 150,
    },
  }));
}

if (process.env.SEED_DB === "true") {
  main();
}
