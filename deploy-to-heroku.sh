#!/bin/bash

# TubeAPI Heroku Deployment Script
# Make this file executable: chmod +x deploy-to-heroku.sh

set -e

echo "🚀 TubeAPI Heroku Deployment Script"
echo "===================================="

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   curl https://cli-assets.heroku.com/install.sh | sh"
    exit 1
fi

# Check if logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "🔐 Please login to Heroku first:"
    heroku login
fi

# Get app name from user
echo ""
read -p "📝 Enter your Heroku app name (e.g., my-tubeapi): " APP_NAME

if [ -z "$APP_NAME" ]; then
    echo "❌ App name cannot be empty"
    exit 1
fi

echo ""
echo "🏗️  Creating Heroku app: $APP_NAME"
heroku create $APP_NAME || echo "⚠️  App might already exist, continuing..."

echo ""
echo "🗄️  Adding PostgreSQL database..."
heroku addons:create heroku-postgresql:essential-0 --app $APP_NAME || echo "⚠️  Database might already exist, continuing..."

echo ""
echo "⚙️  Setting environment variables..."
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set TELEGRAM_BOT_TOKEN=7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0 --app $APP_NAME
heroku config:set TELEGRAM_CHANNEL_ID=-1002863131570 --app $APP_NAME

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
heroku config:set JWT_SECRET="$JWT_SECRET" --app $APP_NAME

echo ""
echo "📡 Adding Heroku remote..."
heroku git:remote -a $APP_NAME || echo "⚠️  Remote might already exist, continuing..."

echo ""
echo "🚢 Deploying to Heroku..."
git add .
git commit -m "Deploy TubeAPI to Heroku" || echo "⚠️  Nothing to commit, continuing..."
git push heroku main || git push heroku master

echo ""
echo "🗃️  Running database migration..."
heroku run npm run db:push --app $APP_NAME

echo ""
echo "👤 Creating admin user..."
heroku pg:psql --app $APP_NAME << 'EOF'
INSERT INTO users (username, email, password, role, plan, is_active) 
VALUES ('admin', 'admin@tubeapi.com', '$2b$10$MTpgFeLC5GvGwWcW2CsiNO/TDIuWJCuR6RHILF6ehddnFHONuSoP.', 'admin', 'enterprise', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO api_keys (user_id, key, name, is_active, usage_limit, daily_limit, daily_usage, usage_count)
SELECT id, 'sk-admin-70k-daily-limit', 'Admin High Volume Key (70k/day)', true, 999999, 70000, 0, 0
FROM users WHERE email = 'admin@tubeapi.com'
ON CONFLICT (key) DO NOTHING;
EOF

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your app is available at: https://$APP_NAME.herokuapp.com"
echo ""
echo "🔑 Admin Credentials:"
echo "   Email: admin@tubeapi.com"
echo "   Password: admin123"
echo ""
echo "🗝️  API Key (70k daily requests): sk-admin-70k-daily-limit"
echo ""
echo "🧪 Test your API:"
echo "   curl -H \"Authorization: Bearer sk-admin-70k-daily-limit\" \\"
echo "        \"https://$APP_NAME.herokuapp.com/api/song/dQw4w9WgXcQ\""
echo ""
echo "📊 Monitor your app:"
echo "   heroku logs --tail --app $APP_NAME"
echo ""
echo "🎉 Happy downloading!"