
import json
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

def update():
    now = datetime.now(timezone(timedelta(hours=8)))
    folder = Path("data")
    folder.mkdir(exist_ok=True)

    for game, (endpoint, key) in GAMES.items():
        params = urllib.parse.urlencode({
            "period": "",
            "month": now.strftime("%Y-%m"),
            "pageNum": 1,
            "pageSize": 50
        })

        url = BASE + endpoint + "?" + params

        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"}
        )

        with urllib.request.urlopen(
            request, timeout=30
        ) as response:
            result = json.load(response)

        rows = result["content"][key]

        if not isinstance(rows, list) or not rows:
            raise ValueError(
                "No valid data: " + game
            )

        output = {
            "source": url,
            "updated_at": now.isoformat(),
            "count": len(rows),
            "records": rows
        }

        path = folder / (game + ".json")

        path.write_text(
            json.dumps(
                output,
                ensure_ascii=False,
                indent=2
            ),
            encoding="utf-8"
        )

        print(game, len(rows), "records")

if __name__ == "__main__":
    update()
