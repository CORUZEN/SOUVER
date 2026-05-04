import json

with open('Tabelas/USER_TAB_COLUMNS_202604161646.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

rows = data[list(data.keys())[0]]

cols = []
for r in rows:
    if r['TABLE_NAME'] == 'TGFCAB':
        cols.append(r['COLUMN_NAME'])

cols.sort()
for c in cols:
    print(c)
