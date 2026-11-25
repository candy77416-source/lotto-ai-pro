
(function () {
  "use strict";

  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) {
      r = r * (n - i + 1) / i;
    }
    return r;
  }

  function probability(m, k) {
    return choose(m, k) *
      choose(49 - m, 6 - k) /
      choose(49, 6);
  }

  function overlap(a, b) {
    const s = new Set(b);
    return a.filter(n => s.has(n)).length;
  }

  function latestBefore(rows, date) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].date < date) return rows[i];
    }
    return null;
  }

  function compare(targets, source, mode) {
    const counts = Array(7).fill(0);
    const expected = Array(7).fill(0);
    let total = 0;
    let tailHits = 0;
    let jumpHits = 0;
    let expectedTail = 0;
    let expectedJump = 0;
    let sameTotal = 0;

    for (const target of targets) {
      let nums = [];

      if (mode === "last3") {
        const previous = source.filter(
          r => r.date < target.date
        ).slice(-3);

        if (previous.length < 3) continue;

        nums = [...new Set(
          previous.flatMap(r => r.nums)
        )];
      } else {
        const previous = latestBefore(
          source, target.date
        );

        if (!previous) continue;

        const age = (
          Date.parse(target.date) -
          Date.parse(previous.date)
        ) / 86400000;

        if (age > 7) continue;

        nums = [...new Set(previous.nums)];
      }

      const n = overlap(target.nums, nums);
      counts[n]++;
      sameTotal += n;
      total++;

      for (let k = 0; k <= 6; k++) {
        expected[k] += probability(nums.length, k);
      }

      const tailSet = new Set(
        nums.map(n => n % 10)
      );

      const tailPool = Array.from(
        { length: 49 }, (_, i) => i + 1
      ).filter(n => tailSet.has(n % 10));

      const jumpPool = Array.from(
        { length: 49 }, (_, i) => i + 1
      ).filter(n => nums.some(
        x => [10, 20, 30].includes(
          Math.abs(n - x)
        )
      ));

      tailHits += overlap(
        target.nums, tailPool
      );

      jumpHits += overlap(
        target.nums, jumpPool
      );

      expectedTail += 6 * tailPool.length / 49;
      expectedJump += 6 * jumpPool.length / 49;
    }

    return {
      total,
      counts,
      expected,
      sameTotal,
      tailHits,
      jumpHits,
      expectedTail,
      expectedJump
    };
  }

  function pct(value, total) {
    if (!total) return "—";
    return (100 * value / total).toFixed(2) + "%";
  }

  function resultTable(title, r) {
    if (!r.total) {
      return "<h3>" + title +
        "</h3><p>資料不足</p>";
    }

    let html = "<h3>" + title + "</h3>";

    html += "<p>有效樣本：" +
      r.total + "期</p>";

    html += "<table><thead><tr>" +
      "<th>重疊碼數</th>" +
      "<th>歷史次數</th>" +
      "<th>歷史比例</th>" +
      "<th>理論比例</th>" +
      "</tr></thead><tbody>";

    for (let k = 0; k <= 6; k++) {
      html += "<tr><td>" + k + "碼</td>" +
        "<td>" + r.counts[k] + "</td>" +
        "<td>" + pct(r.counts[k], r.total) +
        "</td><td>" +
        pct(r.expected[k], r.total) +
        "</td></tr>";
    }

    html += "</tbody></table>";

    html += "<p>平均重疊：" +
      (r.sameTotal / r.total).toFixed(3) +
      "碼</p>";

    html += "<p>至少重疊1碼：" +
      pct(r.total - r.counts[0], r.total) +
      "</p>";

    html += "<p>恰好重疊1至2碼：" +
      pct(r.counts[1] + r.counts[2], r.total) +
      "</p>";

    html += "<p>平均同尾數命中：" +
      (r.tailHits / r.total).toFixed(3) +
      "碼｜理論：" +
      (r.expectedTail / r.total).toFixed(3) +
      "</p>";

    html += "<p>平均跳號命中：" +
      (r.jumpHits / r.total).toFixed(3) +
      "碼｜理論：" +
      (r.expectedJump / r.total).toFixed(3) +
      "</p>";

    return html;
  }

  const panel = document.createElement("div");
  panel.className = "card";

  panel.innerHTML = `
    <h2>三彩連動研究 V4.0</h2>
    <p>研究目標：大樂透</p>
    <select id="crossPeriod">
      <option value="30">最近30期</option>
      <option value="50">最近50期</option>
      <option value="100">最近100期</option>
      <option value="200">最近200期</option>
      <option value="999999" selected>
        全部歷史資料
      </option>
    </select>
    <button id="crossRun">執行三彩連動分析</button>
    <div id="crossResult">
      <p>請按上方按鈕開始研究。</p>
    </div>
    <p>僅使用目標開獎日前的資料。
    歷史比例不代表未來開獎機率。</p>
  `;

  document.body.appendChild(panel);

  function run() {
    const result = document.getElementById(
      "crossResult"
    );

    if (typeof db === "undefined" ||
        !db.lotto649 ||
        !db.super638 ||
        !db.daily539) {
      result.textContent = "三彩資料尚未載入。";
      return;
    }

    const limit = Number(
      document.getElementById(
        "crossPeriod"
      ).value
    );

    const lotto = db.lotto649.rows;
    const power = db.super638.rows;
    const daily = db.daily539.rows;
    const targets = lotto.slice(-limit);

    const a = compare(targets, power, "previous");
    const b = compare(targets, daily, "previous");
    const c = compare(targets, lotto, "last3");

    result.innerHTML =
      resultTable("威力彩 → 大樂透", a) +
      resultTable("今彩539 → 大樂透", b) +
      resultTable("大樂透最近三期留號", c) +
      "<p>研究模式：零元模擬。<br>" +
      "理論基準為公平隨機開獎。" +
      "歷史差異尚須透過獨立盲測驗證。</p>";
  }

  document.getElementById(
    "crossRun"
  ).addEventListener("click", run);

  const subtitle = document.querySelector(
    "body > small"
  );

  if (subtitle) {
    subtitle.textContent =
      "私人數據研究室 V4.0";
  }

  document.title = "LOTTO AI PRO V4.0";

})();
