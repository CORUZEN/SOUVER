import re

with open('src/components/faturamento/PlanejamentoDiario.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if not stripped or stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*') or stripped.startswith('{/*'):
        continue
    if '/' not in stripped:
        continue
    # Skip Tailwind class patterns
    if 'bg-' in stripped or 'from-' in stripped or 'to-' in stripped or 'border-' in stripped or 'text-' in stripped:
        continue
    # Look for / that could be interpreted as regex start
    if re.search(r"[^'\"\w]\s*/\s*[^\s>'\"]", stripped):
        print(f"{i}: {stripped[:120]}")
