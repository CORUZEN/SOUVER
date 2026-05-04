import json

with open('Tabelas/USER_TAB_COLUMNS_202604161646.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

rows = data[list(data.keys())[0]]

print("=== TGFEST ===")
for r in rows:
    if r['TABLE_NAME'] == 'TGFEST':
        print(f"  {r['COLUMN_NAME']} {r['DATA_TYPE']}({r.get('DATA_LENGTH','')}) NULLABLE={r.get('NULLABLE','')}")
