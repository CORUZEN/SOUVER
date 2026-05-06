import os

for root, dirs, files in os.walk('src/app/(dashboard)'):
    if 'page.tsx' in files:
        path = os.path.join(root, 'page.tsx')
        rel = os.path.relpath(path, 'src/app/(dashboard)').replace('\\', '/')
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        is_client = "'use client'" in content or '"use client"' in content
        has_default_export = 'export default' in content
        print(f'{rel:55s} | client={"SIM" if is_client else "NAO"} | has_export={"SIM" if has_default_export else "NAO"}')
