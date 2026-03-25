#!/bin/bash
echo "=== CLARIXBI PERFORMANCE AUDIT ==="
echo "Date: $(date)"
echo ""

# Lighthouse scores
echo "=== LIGHTHOUSE SCORES ==="
if [ -d "./lighthouse-results" ]; then
  cat ./lighthouse-results/manifest.json 2>/dev/null | head -50
else
  echo "No lighthouse results found. Run: npx lhci collect"
fi
echo ""

# Bundle sizes
echo "=== BUNDLE SIZES ==="
if [ -d ".next/static/chunks" ]; then
  echo "Total JS: $(du -sh .next/static/chunks/ | cut -f1)"
  echo ""
  echo "Largest chunks:"
  ls -la .next/static/chunks/*.js 2>/dev/null | sort -k5 -n -r | head -10
else
  echo "No build output found. Run: npm run build"
fi
echo ""

# Page sizes
echo "=== PAGE SIZES ==="
if [ -d ".next/server/app" ]; then
  echo "Server pages:"
  find .next/server/app -name "*.html" -exec ls -lh {} \; 2>/dev/null | head -10
fi
echo ""

echo "=== TARGETS ==="
echo "Performance: >90"
echo "Accessibility: >95"
echo "Best Practices: >90"
echo "SEO: >90"
echo "LCP: <2.5s"
echo "FID: <100ms"
echo "CLS: <0.1"
