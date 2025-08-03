# TubeAPI Configuration File
# Replace these values with your production setup

# TubeAPI Server Configuration
API_URL = "http://localhost:5000/api"  # Change to your domain: https://your-tubeapi-domain.com/api
API_KEY = "sk-admin-test-key-10k-requests"  # Replace with your actual API key

# Production Setup Example:
# API_URL = "https://tubeapi-production.replit.app/api"
# API_KEY = "sk-prod-your-actual-api-key-here"

# Telegram Configuration (handled by TubeAPI backend)
# Bot Token and Channel ID are managed by the TubeAPI server
# No need to configure here unless you want to override

print("🚀 TubeAPI Configuration Loaded")
print(f"📡 API URL: {API_URL}")
print(f"🔑 API Key: {API_KEY[:10]}...")