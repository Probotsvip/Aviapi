# Heroku Deployment Guide for TubeAPI

## Quick Deploy

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

**Note:** If you get Python buildpack error, run this first:
```bash
# Move Python files temporarily
mkdir temp_backup
mv *.py temp_backup/ 2>/dev/null || echo "No Python files"
git add . && git commit -m "Remove Python files for Heroku"
```

## Manual Deployment Steps

### 1. Install Heroku CLI
```bash
# Install Heroku CLI (if not already installed)
curl https://cli-assets.heroku.com/install.sh | sh
```

### 2. Login to Heroku
```bash
heroku login
```

### 3. Create Heroku App
```bash
heroku create your-tubeapi-app-name
```

### 4. Add PostgreSQL Database
```bash
heroku addons:create heroku-postgresql:essential-0
```

### 5. Set Environment Variables
```bash
# Set required environment variables
heroku config:set NODE_ENV=production
heroku config:set TELEGRAM_BOT_TOKEN=7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0
heroku config:set TELEGRAM_CHANNEL_ID=-1002863131570
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Optional: Add Stripe keys when ready
# heroku config:set STRIPE_SECRET_KEY=your_stripe_secret_key
```

### 6. Deploy to Heroku
```bash
# Add Heroku remote
heroku git:remote -a your-tubeapi-app-name

# Set Node.js buildpack explicitly (to avoid Python detection)
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### 7. Run Database Migration
```bash
heroku run npm run db:push
```

### 8. Create Admin User and API Key
```bash
# Connect to PostgreSQL
heroku pg:psql

# Create admin user
INSERT INTO users (username, email, password, role, plan, is_active) 
VALUES ('admin', 'admin@tubeapi.com', '$2b$10$MTpgFeLC5GvGwWcW2CsiNO/TDIuWJCuR6RHILF6ehddnFHONuSoP.', 'admin', 'enterprise', true);

# Get the user ID (copy the ID from the result)
SELECT id FROM users WHERE email = 'admin@tubeapi.com';

# Create API key with 70k daily limit (replace USER_ID with actual ID)
INSERT INTO api_keys (user_id, key, name, is_active, usage_limit, daily_limit, daily_usage, usage_count)
VALUES ('USER_ID_HERE', 'sk-admin-70k-daily-limit', 'Admin High Volume Key (70k/day)', true, 999999, 70000, 0, 0);

# Exit PostgreSQL
\q
```

### 9. Test Your Deployment
```bash
# Get your app URL
heroku open

# Test API endpoint
curl -H "Authorization: Bearer sk-admin-70k-daily-limit" \
     "https://your-tubeapi-app-name.herokuapp.com/api/song/dQw4w9WgXcQ"
```

## Important Notes

1. **PostgreSQL Database**: Heroku will automatically provide `DATABASE_URL`
2. **Port Configuration**: Heroku automatically sets the `PORT` environment variable
3. **Build Process**: The app will build automatically during deployment
4. **Logs**: View logs with `heroku logs --tail`
5. **Scaling**: Scale with `heroku ps:scale web=1`

## Environment Variables Required

- `NODE_ENV`: production
- `DATABASE_URL`: (Auto-provided by Heroku Postgres)
- `TELEGRAM_BOT_TOKEN`: 7412125068:AAE_xef9Tgq0MZXpknz3-WPPKK7hl6t3im0
- `TELEGRAM_CHANNEL_ID`: -1002863131570
- `JWT_SECRET`: (Generate with `openssl rand -base64 32`)
- `PORT`: (Auto-provided by Heroku)

## Troubleshooting

### Build Issues
```bash
# Check build logs
heroku logs --tail --dyno=web

# Restart app
heroku restart
```

### Database Issues
```bash
# Check database connection
heroku pg:info

# Reset database (if needed)
heroku pg:reset DATABASE_URL --confirm your-app-name
heroku run npm run db:push
```

### Performance Monitoring
```bash
# Monitor app performance
heroku ps
heroku logs --tail
```

## Cost Estimation

- **Heroku Dyno**: $7/month (Eco plan)
- **PostgreSQL**: $9/month (Essential-0 plan)
- **Total**: ~$16/month

## Security Considerations

1. Use strong JWT secrets
2. Regularly rotate API keys
3. Monitor usage through admin panel
4. Set up proper rate limiting
5. Keep Telegram bot token secure

## API Usage After Deployment

Your API will be available at: `https://your-app-name.herokuapp.com`

### Audio Download
```bash
curl -H "Authorization: Bearer sk-admin-70k-daily-limit" \
     "https://your-app-name.herokuapp.com/api/song/VIDEO_ID"
```

### Video Download
```bash
curl -H "Authorization: Bearer sk-admin-70k-daily-limit" \
     "https://your-app-name.herokuapp.com/api/video/VIDEO_ID"
```

### Admin Panel
Access at: `https://your-app-name.herokuapp.com`
- Email: admin@tubeapi.com
- Password: admin123