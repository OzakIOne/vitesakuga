import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const config = new pulumi.Config();
// We'll try to get the accountId from config, or fallback to an environment variable
const accountId = config.get("accountId") || process.env.CLOUDFLARE_ACCOUNT_ID;

if (!accountId) {
    throw new Error("Cloudflare Account ID is required. Set it via 'pulumi config set cloudflare:accountId <id>'");
}

// Create an R2 bucket
const bucket = new cloudflare.R2Bucket("sakuga-bucket", {
    accountId: accountId,
    name: "vitesakuga-media", // This will be the name of the bucket
});

// Output the bucket name and account ID for the .env file
export const bucketName = bucket.name;
export const cloudflareAccountId = accountId;
export const r2Endpoint = pulumi.interpolate`https://${accountId}.r2.cloudflarestorage.com`;
