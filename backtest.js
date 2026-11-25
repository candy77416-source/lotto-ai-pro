
(function () {
  "use strict";

  const panel = document.createElement("div");
  panel.className = "card";

  panel.innerHTML = `
    <h2>歷史盲測引擎 V5.0</h2>
    <p>七種模型與隨機基準比較</p>

    <p>歷史測試期數</p>
    <select id="btPeriod">
      <option value="30">最近30期</option>
      <option value="50">最近50期</option>
      <option value="100" selected>最近100期</option>
      <option value="150">最近150期</option>
    </select>

    <p>每期模擬組數</p>
    <select id="btTickets">
      <option value="4">4組</option>
      <option value="8" selected>8組</option>
      <option value="12">12組</option>
    </select>

    <button id="btRun">開始歷史盲測</button>
    <p id="btStatus"></p>
    <div id="btResult"></div>

    <p>本功能僅供歷史模擬，
    不提供實際投注建議。</p>
  `;

  document.body.appendChild(panel);

  const names = [
    "A 隨機基準",
    "B 冷熱與週期",
    "C 兩碼三碼關聯",
    "D 最近三期留號",
    "E 威力彩連動",
    "F 今彩539連動",
    "G 綜合模型"
  ];

  const pool = Array.from(
    {length:49}, (_,i)=>i+1
  );

  function rng(seed) {
    let x = seed >>> 0;
    return function () {
      x = (Math.imul(1664525,x)
        +1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function key(a) {
    return [...a].sort((x,y)=>x-y).join("-");
  }

  function latestBefore(rows,date) {
    for(let i=rows.length-1;i>=0;i--){
      if(rows[i].date<date)
        return rows[i].nums;
    }
    return [];
  }

  function features(history) {
    const freq = Array(50).fill(0);
    const gap = Array(50).fill(history.length);
    const pairs = new Map();
    const triples = new Map();

    history.forEach((r,index)=>{
      const a=r.nums;

      a.forEach(n=>{
        freq[n]++;
        gap[n]=history.length-1-index;
      });

      for(let i=0;i<a.length;i++){
        for(let j=i+1;j<a.length;j++){
          const p=key([a[i],a[j]]);
          pairs.set(p,(pairs.get(p)||0)+1);

          for(let k=j+1;k<a.length;k++){
            const t=key([a[i],a[j],a[k]]);
            triples.set(t,
              (triples.get(t)||0)+1);
          }
        }
      }
    });

    return {freq,gap,pairs,triples};
  }

  function matchCount(a,b) {
    const s=new Set(b);
    return a.filter(n=>s.has(n)).length;
  }

  function sample(random) {
    const a=[...pool];

    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }

    return a.slice(0,6).sort((a,b)=>a-b);
  }

  function association(a,f) {
    let score=0;

    for(let i=0;i<a.length;i++){
      for(let j=i+1;j<a.length;j++){
        score+=f.pairs.get(
          key([a[i],a[j]])
        )||0;

        for(let k=j+1;k<a.length;k++){
          score+=2*(f.triples.get(
            key([a[i],a[j],a[k]])
          )||0);
        }
      }
    }

    return score;
  }

  function score(a,model,f,recent,power,daily) {
    const hot=a.reduce(
      (s,n)=>s+f.freq[n],0
    );

    const cold=a.reduce(
      (s,n)=>s+Math.min(f.gap[n],30),0
    );

    const r=matchCount(a,recent);
    const p=matchCount(a,power);
    const d=matchCount(a,daily);

    switch(model){
      case 1:
        return hot+0.3*cold;

      case 2:
        return association(a,f);

      case 3:
        return -Math.abs(r-2);

      case 4:
        return -Math.abs(p-1);

      case 5:
        return -Math.abs(d-1);

      case 6:
        return hot*0.2+
          association(a,f)*0.3-
          Math.abs(r-2)*2-
          Math.abs(p-1)-
          Math.abs(d-1);

      default:
        return 0;
    }
  }

  function testGroups(model,count,f,recent,
      power,daily,random) {

    const candidates=[];
    const seen=new Set();

    const limit=model===0?count:200;

    while(candidates.length<limit){
      const a=sample(random);
      const k=key(a);

      if(seen.has(k))continue;
      seen.add(k);

      candidates.push({
        nums:a,
        value:score(
          a,model,f,recent,power,daily
        )
      });
    }

    if(model!==0){
      candidates.sort(
        (a,b)=>b.value-a.value
      );
    }

    return candidates.slice(0,count);
  }

  function run() {
    const result=document.getElementById(
      "btResult"
    );

    const status=document.getElementById(
      "btStatus"
    );

    if(typeof db==="undefined"||
       !db.lotto649||
       !db.super638||
       !db.daily539){
      status.textContent="三彩資料尚未載入";
      return;
    }

    const lotto=db.lotto649.rows;
    const power=db.super638.rows;
    const daily=db.daily539.rows;

    const count=Number(
      document.getElementById(
        "btTickets"
      ).value
    );

    const limit=Number(
      document.getElementById(
        "btPeriod"
      ).value
    );

    if(lotto.length<100){
      status.textContent="歷史資料不足";
      return;
    }

    const start=Math.max(
      60,lotto.length-limit
    );

    const stats=names.map(name=>({
      name,
      hits:Array(7).fill(0),
      total:0,
      sum:0,
      best:0,
      rounds:0,
      rounds3:0
    }));

    for(let i=start;i<lotto.length;i++){
      const target=lotto[i];

      const history=lotto.slice(
        Math.max(0,i-60),i
      );

      const f=features(history);

      const recent=[...new Set(
        history.slice(-3)
        .flatMap(r=>r.nums)
      )];

      const p=latestBefore(
        power,target.date
      );

      const d=latestBefore(
        daily,target.date
      );

      for(let m=0;m<names.length;m++){
        const random=rng(20261125+i*7919);

        const groups=testGroups(
          m,count,f,recent,p,d,random
        );

        const s=stats[m];
        let roundBest=0;

        groups.forEach(g=>{
          const hit=matchCount(
            g.nums,target.nums
          );

          s.hits[hit]++;
          s.total++;
          s.sum+=hit;
          s.best=Math.max(s.best,hit);
          roundBest=Math.max(
            roundBest,hit
          );
        });

        s.rounds++;
        if(roundBest>=3)s.rounds3++;
      }
    }

    const baseline=stats[0].sum/
      stats[0].total;

    let html="<h3>歷史盲測結果</h3>";

    html+="<p>測試期數："+
      (lotto.length-start)+"期</p>";

    html+="<p>測試日期："+
      lotto[start].date+" ～ "+
      lotto[lotto.length-1].date+
      "</p>";

    html+="<p>每模型模擬："+
      stats[0].total+"組</p>";

    html+="<p>每期訓練範圍：前60期</p>";

    stats.forEach(s=>{
      const avg=s.sum/s.total;
      const three=s.hits.slice(3)
        .reduce((a,b)=>a+b,0);

      html+="<h3>"+s.name+"</h3>";

      html+="<table><thead><tr>"+
        "<th>命中主號</th>"+
        "<th>組數</th>"+
        "<th>比例</th>"+
        "</tr></thead><tbody>";

      for(let k=0;k<=6;k++){
        html+="<tr><td>"+k+
          "碼</td><td>"+s.hits[k]+
          "</td><td>"+
          (100*s.hits[k]/s.total)
          .toFixed(2)+
          "%</td></tr>";
      }

      html+="</tbody></table>";

      html+="<p>平均命中："+
        avg.toFixed(3)+"碼</p>";

      html+="<p>與隨機基準差距："+
        (avg-baseline).toFixed(3)+
        "碼</p>";

      html+="<p>單組至少3碼："+
        (100*three/s.total).toFixed(2)+
        "%</p>";

      html+="<p>每期至少一組3碼以上："+
        (100*s.rounds3/s.rounds)
        .toFixed(2)+"%</p>";

      html+="<p>最高單組命中："+
        s.best+"碼</p>";
    });

    html+="<p>公平隨機模型每組"+
      "理論平均命中："+
      (36/49).toFixed(3)+"碼</p>";

    html+="<p>實際投注支出：NT$0</p>";

    html+="<p>本次結果屬探索性回測，"+
      "不構成預測優勢證明。"+
      "仍需獨立資料及重複實驗驗證。</p>";

    result.innerHTML=html;
    status.textContent="歷史盲測完成";
  }

  document.getElementById(
    "btRun"
  ).addEventListener("click",()=>{
    document.getElementById(
      "btStatus"
    ).textContent="正在進行歷史運算...";
    setTimeout(run,50);
  });

  const subtitle=document.querySelector(
    "body > small"
  );

  if(subtitle){
    subtitle.textContent=
      "私人數據研究室 V5.0";
  }

  document.title="LOTTO AI PRO V5.0";

})();
