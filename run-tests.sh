kill $(lsof -t -i :3000) 2>/dev/null || true
kill $(lsof -t -i :4000) 2>/dev/null || true
kill $(lsof -t -i :5001) 2>/dev/null || true
kill $(lsof -t -i :8080) 2>/dev/null || true
kill $(lsof -t -i :9099) 2>/dev/null || true
kill $(lsof -t -i :9199) 2>/dev/null || true
mkdir -p test-results
npx playwright test tests/e2e/live-portfolio.spec.ts
