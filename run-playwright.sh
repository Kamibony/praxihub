kill $(lsof -t -i :3000) 2>/dev/null || true
npx playwright test tests/e2e/live-portfolio.spec.ts
