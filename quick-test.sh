#!/bin/bash

# Quick API Test Script
# Run this after deploying to test your API

echo "🧪 Quick API Test for Central Chat Dashboard"
echo "============================================="

# Replace with your actual domain
DOMAIN="https://central-chat-dashboard.com"

echo "Testing domain: $DOMAIN"
echo ""

# Test 1: Root endpoint
echo "1. Testing root endpoint..."
curl -s "$DOMAIN/" | jq . 2>/dev/null || curl -s "$DOMAIN/"
echo ""

# Test 2: Health check
echo "2. Testing health check..."
curl -s "$DOMAIN/api/health" | jq . 2>/dev/null || curl -s "$DOMAIN/api/health"
echo ""

# Test 3: Register admin agent
echo "3. Testing agent registration..."
curl -s -X POST "$DOMAIN/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin Agent",
    "email": "admin@test.com",
    "password": "password123"
  }' | jq . 2>/dev/null || echo "Registration response received"
echo ""

# Test 4: Login
echo "4. Testing agent login..."
LOGIN_RESPONSE=$(curl -s -X POST "$DOMAIN/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Test 5: Register website
echo "5. Testing website registration..."
curl -s -X POST "$DOMAIN/api/websites/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Website",
    "domain": "test.com"
  }' | jq . 2>/dev/null || echo "Website registration response received"
echo ""

echo "✅ Basic API tests completed!"
echo ""
echo "If you see JSON responses above, your API is working correctly!"
echo "If you see errors, check:"
echo "1. PM2 logs: pm2 logs chat-dashboard"
echo "2. Database connection in .env file"
echo "3. All dependencies installed: npm install"
