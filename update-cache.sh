#!/bin/bash

# Script to update cache files from Railway backend

echo "Fetching stats..."
curl -s "https://scintillating-charisma-production.up.railway.app/api/proxy" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"stats","body":{"year":2025}}' \
  > stats.json

echo "Fetching library..."
curl -s "https://scintillating-charisma-production.up.railway.app/api/proxy" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"library","body":{"page":1,"numOfPages":1,"totalCount":0,"libraryType":"books","sort":"-recent","pageSize":50}}' \
  > library.json

echo "Cache updated! Commit and push to deploy:"
echo "  git add stats.json library.json"
echo "  git commit -m 'Update cache'"
echo "  git push origin gh-pages"
