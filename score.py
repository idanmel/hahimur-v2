import os, re, glob

# Actual results for the 8 played matches, in the repo's home/away orientation
# id -> (home_goals, away_goals)
RESULTS = {
    'A1': (2, 0),  # Mexico - South Africa
    'A2': (2, 1),  # South Korea - Czech Republic
    'B1': (1, 1),  # Canada - Bosnia
    'B2': (1, 1),  # Qatar - Switzerland
    'C1': (1, 1),  # Brazil - Morocco
    'C2': (0, 1),  # Haiti - Scotland
    'D1': (4, 1),  # United States - Paraguay
    'D2': (2, 0),  # Australia - Turkey
}

PTS_EXACT = 4
PTS_DIR = 2

def sign(a, b):
    return 0 if a == b else (1 if a > b else -1)

def score_file(path):
    txt = open(path, encoding='utf-8').read()
    label_m = re.search(r"export const label = '([^']+)'", txt)
    label = label_m.group(1) if label_m else os.path.basename(path)
    total = 0
    exact = 0
    direction = 0
    detail = {}
    for mid, (rh, ra) in RESULTS.items():
        m = re.search(r"id: '" + mid + r"'.*?scores: \{ home: (-?\d+), away: (-?\d+) \}", txt)
        if not m:
            detail[mid] = 'NA'
            continue
        ph, pa = int(m.group(1)), int(m.group(2))
        if ph == rh and pa == ra:
            total += PTS_EXACT; exact += 1; detail[mid] = f'{ph}-{pa} EXACT'
        elif sign(ph, pa) == sign(rh, ra):
            total += PTS_DIR; direction += 1; detail[mid] = f'{ph}-{pa} dir'
        else:
            detail[mid] = f'{ph}-{pa} miss'
    return label, total, exact, direction, detail

rows = []
for path in glob.glob(os.path.join(os.path.dirname(__file__), 'src', 'users', '*.ts')):
    if path.endswith('index.ts'):
        continue
    rows.append(score_file(path))

rows.sort(key=lambda r: (-r[1], -r[2]))
print(f"{'#':>2}  {'Player':<22} {'Pts':>4} {'Exact':>5} {'Dir':>4}")
print('-' * 45)
for i, (label, total, exact, direction, detail) in enumerate(rows, 1):
    star = '  <== YOU' if 'ליאור' in label else ''
    print(f"{i:>2}. {label:<22} {total:>4} {exact:>5} {direction:>4}{star}")

print('\n--- Lior detail ---')
for label, total, exact, direction, detail in rows:
    if 'ליאור' in label:
        for mid in RESULTS:
            print(f"  {mid}: pick {detail[mid]}  (actual {RESULTS[mid][0]}-{RESULTS[mid][1]})")
