

import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/"

GAMES = {
    "lotto649": ("Lotto649Result", "lotto649Res"),
    "super638": ("SuperLotto638Result", "superLotto638Res"),
    "daily539": ("Daily539Result", "daily539Res")
}

HISTORY_MONTHS = 12

def get_months(now):
    months = []
    for i in range(HISTORY_MONTHS):
        value = now.year * 12 + now.month - 1 - i
        year, month = divmod(value, 12)
        months.append(f"{year}-{month+1:02d}")
    return months

def fetch(endpoint, key, month):
    params = urllib.parse.urlencode({
        "period": "",
        "month": month,
        "pageNum": 1,
        "pageSize": 100
    })

    url = BASE + endpoint + "?" + params

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )

    with urllib.request.urlopen(
        request, timeout=15
    ) as response:
        result = json.load(response)

    rows = result["content"][key]

    if not isinstance(rows, list):
        raise ValueError("Invalid response")

    return rows

def record_key(row):
    return str(
        row.get("period")
        or row["lotteryDate"]
    )

def update():
    now = datetime.now(
        timezone(timedelta(hours=8))
    )

    folder = Path("data")
    folder.mkdir(exist_ok=True)

    months = get_months(now)

    for game, (endpoint, key) in GAMES.items():
        path = folder / (game + ".json")
        records = {}
        completed = set()

        if path.exists():
            old = json.loads(
                path.read_text(encoding="utf-8")
            )

            for row in old.get("records", []):
                records[record_key(row)] = row

            completed = set(
                old.get("completed_months", [])
            )

        errors = []

        for month in months:
            if month in completed and month not in months[:2]:
                continue

            try:
                rows = fetch(endpoint, key, month)

                if not rows:
                    raise ValueError("Empty month")

                for row in rows:
                    records[record_key(row)] = row

                completed.add(month)

                print(game, month, len(rows), "records")

            except Exception as e:
                errors.append(month)
                print("WARNING", game, month, str(e))

            time.sleep(0.5)

        sorted_rows = sorted(
            records.values(),
            key=lambda row: str(row["lotteryDate"])
        )

        output = {
            "game": game,
            "source": BASE + endpoint,
            "updated_at": now.isoformat(),
            "count": len(sorted_rows),
            "completed_months": sorted(completed),
            "failed_months": errors,
            "records": sorted_rows
        }

        temp = path.with_suffix(".tmp")

        temp.write_text(
            json.dumps(
                output,
                ensure_ascii=False,
                indent=2
            ),
            encoding="utf-8"
        )

        temp.replace(path)

        print(game, "TOTAL:", len(sorted_rows))

if __name__ == "__main__":
    update()
