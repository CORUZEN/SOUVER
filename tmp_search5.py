import json

with open('Tabelas/USER_TAB_COLUMNS_202604161646.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

rows = data[list(data.keys())[0]]

keywords = ['CONFIRM', 'LIB', 'APROV', 'STATUS', 'PENDENTE']
for r in rows:
    if r['TABLE_NAME'] == 'TGFCAB':
        col = r['COLUMN_NAME'].upper()
        if any(k in col for k in keywords):
            print(f"{r['TABLE_NAME']}.{r['COLUMN_NAME']} {r['DATA_TYPE']}({r.get('DATA_LENGTH','')}) NULLABLE={r.get('NULLABLE','')}")
