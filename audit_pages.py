import os

pages = []
for root, dirs, files in os.walk('src/app/(dashboard)'):
    if 'page.tsx' in files:
        path = os.path.join(root, 'page.tsx')
        rel = os.path.relpath(path, 'src/app/(dashboard)').replace('\\', '/')
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        has_getModulePermissions = 'getModulePermissions' in content
        has_redirect_accesso = "redirect('/acesso-negado')" in content
        has_auth_check = 'getAuthUser' in content or 'getCurrentUser' in content or 'cookies()' in content
        pages.append((rel, has_getModulePermissions, has_redirect_accesso, has_auth_check))

for rel, has_mod, has_red, has_auth in pages:
    protected = has_mod or has_red
    status = 'SIM' if protected else 'NAO'
    auth_status = 'SIM' if has_auth else 'NAO'
    mod_status = 'SIM' if has_mod else 'NAO'
    print(f'{rel:60s} | protegido={status} | auth={auth_status} | getModulePermissions={mod_status}')
