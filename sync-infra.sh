#!/bin/bash

# Navigate to infra directory to get outputs
cd infra > /dev/null

# Get outputs from Pulumi
BUCKET_NAME=$(pulumi stack output bucketName)
ACCOUNT_ID=$(pulumi stack output cloudflareAccountId)
R2_ENDPOINT=$(pulumi stack output r2Endpoint)

cd .. > /dev/null

# Update .env file
# We use sed to replace or append values
update_env() {
    local key=$1
    local value=$2
    if grep -q "^$key=" .env; then
        sed -i "s|^$key=.*|$key=$value|" .env
    else
        echo "$key=$value" >> .env
    fi
}

if [ -f .env ]; then
    echo "Updating .env with Cloudflare details..."
    update_env "CLOUDFLARE_BUCKET" "$BUCKET_NAME"
    update_env "CLOUDFLARE_R2" "$ACCOUNT_ID" # Assuming this is where Account ID goes

    echo "Done! Pulumi outputs synced to .env"
    echo "Note: You still need to manually add CLOUDFLARE_ACCESS_KEY and CLOUDFLARE_SECRET_KEY"
    echo "from the Cloudflare Dashboard (Manage R2 API Tokens)."
else
    echo ".env file not found. Please create it first (e.g., cp .env.example .env)"
fi
