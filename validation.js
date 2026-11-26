
(function () {
  "use strict";

  const panel = document.createElement("div");
  panel.className = "card";

  panel.innerHTML = `
    <h2>進階模型驗證 V5.1</h2>
    <p>多次隨機實驗與歷史模型比較</p>

    <p>訓練資料範圍</p>
    <select id="valTrain">
      <option value="30">前30期</option>
      <option value="60" selected>前60期</option>
      <option value="100">前100期</option>
      <option value="150">前150期</option>
    </select>

    <p>測試範圍</p>
    <select id="valPeriod">
      <option value="50">最近50期</option>
      <option value="100" selected>最近100期</option>
      <option value="150">最近150期</option>
    </select>

    <p>重複實驗次數</p>
    <select id="valRepeat">
      <option value="5" selected>5次</option>
      <option value="10">10次</option>
      <option value="20">20次</option>
    </select>

    <button id="valRun">開始進階驗證</button>
    <p id="valStatus"></p>
    <div id="valResult"></div>
    <p>僅供歷史統計研究，實際投注NT$0。</p>
  `;

  document.body.appendChild(panel);

  const names = [
    "A 隨機基準",
    "B 冷熱週期",
    "C 兩碼三碼關聯",
    "D 最近三期留號",
    "E 威力彩連動",
    "F 今彩539連動",
    "G 綜合模型"
  ];

  function rng(seed) {
    let x = seed >>> 0;
    return function () {
      x = (Math.imul(x,1664525)
        +1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function sample(random) {
    const s = new Set();

    while(s.size < 6) {
      s.add(1 + Math.floor(random()*49));
    }

    return [...s].sort((a,b)=>a-b);
  }

  function clean(rows,size,max) {
    if(!Array.isArray(rows))
      throw new Error("資料格式錯誤");

    const seen = new Set();

    return rows.map(r=>{
      const date = String(r.date).slice(0,10);
      const nums = r.nums.map(Number)
        .sort((a,b)=>a-b);

      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date))
        || nums.length !== size
        || new Set(nums).size !== size
        || nums.some(n=>
          !Number.isInteger(n)||n<1||n>max)
        || seen.has(date)) {
        throw new Error("發現異常資料："+date);
      }

      seen.add(date);
      return {date,nums};

    }).sort((a,b)=>a.date.localeCompare(b.date));
  }

  function hit(a,b) {
    return a.filter(n=>b.includes(n)).length;
  }

  function latest(rows,date) {
    for(let i=rows.length-1;i>=0;i--) {
      if(rows[i].date<date) {
        const age=(Date.parse(date)-
          Date.parse(rows[i].date))/86400000;
        return age<=7?rows[i].nums:null;
      }
    }
    return null;
  }

  function keys(a) {
    const p=[],t=[];

    for(let i=0;i<a.length;i++) {
      for(let j=i+1;j<a.length;j++) {
        p.push(a[i]*50+a[j]);

        for(let k=j+1;k<a.length;k++) {
          t.push(a[i]*2500+a[j]*50+a[k]);
        }
      }
    }

    return {p,t};
  }

  function features(history) {
    const freq=Array(50).fill(0);
    const gap=Array(50).fill(history.length);
    const pairs=new Map();
    const triples=new Map();

    history.forEach((r,i)=>{
      r.nums.forEach(n=>{
        freq[n]++;
        gap[n]=history.length-1-i;
      });

      const k=keys(r.nums);

      k.p.forEach(x=>
        pairs.set(x,(pairs.get(x)||0)+1));

      k.t.forEach(x=>
        triples.set(x,(triples.get(x)||0)+1));
    });

    return {freq,gap,pairs,triples};
  }

  function scores(a,f,recent,power,daily) {
    const k=keys(a);

    const hot=a.reduce(
      (s,n)=>s+f.freq[n],0);

    const cold=a.reduce(
      (s,n)=>s+Math.min(f.gap[n],30),0);

    const assoc=k.p.reduce(
      (s,n)=>s+(f.pairs.get(n)||0),0)
      +2*k.t.reduce(
      (s,n)=>s+(f.triples.get(n)||0),0);

    const r=Math.abs(hit(a,recent)-2);
    const p=Math.abs(hit(a,power)-1);
    const d=Math.abs(hit(a,daily)-1);

    return [
      0,
      hot+0.3*cold,
      assoc,
      -r,
      -p,
      -d,
      hot*0.2+assoc*0.3-r*2-p-d
    ];
  }

  function coverage(groups) {
    const numbers=new Set();
    const pairs=new Set();
    const triples=new Set();

    groups.forEach(a=>{
      a.forEach(n=>numbers.add(n));
      const k=keys(a);
      k.p.forEach(n=>pairs.add(n));
      k.t.forEach(n=>triples.add(n));
    });

    return [
      numbers.size,
      pairs.size,
      triples.size
    ];
  }

  function mean(a) {
    return a.reduce((s,x)=>s+x,0)/a.length;
  }

  function ci(a) {
    if(a.length<2)return [NaN,NaN];

    const m=mean(a);
    const variance=a.reduce(
      (s,x)=>s+(x-m)**2,0)/(a.length-1);

    const margin=1.96*
      Math.sqrt(variance/a.length);

    return [m-margin,m+margin];
  }

  function run() {
    const status=document.getElementById(
      "valStatus");

    const result=document.getElementById(
      "valResult");

    const button=document.getElementById(
      "valRun");

    try {
      if(typeof db==="undefined"||
         !db.lotto649||
         !db.super638||
         !db.daily539) {
        throw new Error("三彩資料尚未載入");
      }

      const lotto=clean(db.lotto649.rows,6,49);
      const power=clean(db.super638.rows,6,38);
      const daily=clean(db.daily539.rows,5,39);

      const train=Number(document.getElementById(
        "valTrain").value);

      const period=Number(document.getElementById(
        "valPeriod").value);

      const repeat=Number(document.getElementById(
        "valRepeat").value);

      const start=lotto.length-period;

      if(start<train) {
        throw new Error("訓練資料不足");
      }

      const stats=names.map(name=>({
        name,
        hits:Array(7).fill(0),
        rounds:0,
        rounds3:0,
        numbers:0,
        pairs:0,
        triples:0,
        drawMeans:[]
      }));

      let valid=0;
      let skipped=0;

      for(let i=start;i<lotto.length;i++) {
        const target=lotto[i];

        const history=lotto.slice(i-train,i);
        const f=features(history);

        const recent=[...new Set(
          history.slice(-3)
          .flatMap(r=>r.nums))];

        const p=latest(power,target.date);
        const d=latest(daily,target.date);

        if(!p||!d) {
          skipped++;
          continue;
        }

        valid++;

        const drawSums=Array(7).fill(0);

        for(let rep=0;rep<repeat;rep++) {
          const random=rng(
            314159+i*7919+rep*104729);

          const candidates=[];
          const seen=new Set();

          while(candidates.length<200) {
            const a=sample(random);
            const key=a.join("-");

            if(seen.has(key))continue;
            seen.add(key);

            candidates.push({
              a,
              scores:scores(a,f,recent,p,d)
            });
          }

          for(let m=0;m<7;m++) {
            const list=m===0?candidates:
              [...candidates].sort(
                (a,b)=>b.scores[m]-a.scores[m]);

            const groups=list.slice(0,8)
              .map(x=>x.a);

            const s=stats[m];
            let best=0;

            groups.forEach(a=>{
              const h=hit(a,target.nums);
              s.hits[h]++;
              drawSums[m]+=h;
              best=Math.max(best,h);
            });

            const c=coverage(groups);

            s.numbers+=c[0];
            s.pairs+=c[1];
            s.triples+=c[2];
            s.rounds++;

            if(best>=3)s.rounds3++;
          }
        }

        stats.forEach((s,m)=>{
          s.drawMeans.push(
            drawSums[m]/(repeat*8));
        });
      }

      if(!valid) {
        throw new Error("沒有有效測試期數");
      }

      const total=valid*repeat*8;
      const baseline=mean(stats[0].drawMeans);

      let html="<h3>七大模型驗證總覽</h3>";

      html+="<p>有效測試："+valid+
        "期｜略過："+skipped+"期</p>";

      html+="<p>每模型："+total+"組</p>";

      html+="<p>合計："+(total*7)+"組</p>";

      html+="<p>訓練範圍：前"+train+"期</p>";

      html+="<p>公平隨機理論平均：0.735碼</p>";

      html+="<table><tr>"+
        "<th>模型</th>"+
        "<th>平均命中</th>"+
        "<th>3碼以上</th>"+
        "</tr>";

      stats.forEach(s=>{
        const three=s.hits.slice(3)
          .reduce((a,b)=>a+b,0);

        html+="<tr><td>"+s.name+
          "</td><td>"+
          mean(s.drawMeans).toFixed(3)+
          "</td><td>"+
          (100*three/total).toFixed(2)+
          "%</td></tr>";
      });

      html+="</table>";

      stats.forEach(s=>{
        const avg=mean(s.drawMeans);
        const diff=s.drawMeans.map(
          (v,i)=>v-stats[0].drawMeans[i]);

        const interval=ci(diff);

        html+="<details><summary>"+
          s.name+"</summary>";

        html+="<p>平均命中："+avg.toFixed(3)+
          "碼</p>";

        html+="<p>隨機基準差距："+
          (avg-baseline).toFixed(3)+"碼</p>";

        html+="<p>差距近似95%信賴區間："+
          interval[0].toFixed(3)+" 至 "+
          interval[1].toFixed(3)+"</p>";

        html+="<p>每輪至少一組3碼以上："+
          (100*s.rounds3/s.rounds)
          .toFixed(2)+"%</p>";

        html+="<p>平均不同號碼數："+
          (s.numbers/s.rounds).toFixed(1)+
          " / 49</p>";

        html+="<p>平均不同兩碼組合："+
          (s.pairs/s.rounds).toFixed(1)+
          " / 120</p>";

        html+="<p>平均不同三碼組合："+
          (s.triples/s.rounds).toFixed(1)+
          " / 160</p>";

        html+="</details>";
      });

      html+="<p>實際投注支出：NT$0</p>";

      html+="<p>重複模擬不等於新增開獎樣本。"+
        "信賴區間以各開獎期為單位，"+
        "僅為探索性近似估計。"+
        "尚未校正多重比較及時間相依性。"+
        "歷史表現不代表未來中獎優勢。</p>";

      result.innerHTML=html;
      status.textContent="進階驗證完成";

    } catch(error) {
      status.textContent=error.message;
    } finally {
      button.disabled=false;
    }
  }

  document.getElementById("valRun")
    .addEventListener("click",()=>{
      document.getElementById(
        "valStatus").textContent="正在運算...";
      document.getElementById(
        "valResult").innerHTML="";
      document.getElementById(
        "valRun").disabled=true;
      setTimeout(run,100);
    });

  const subtitle=document.querySelector(
    "body > small");

  if(subtitle) {
    subtitle.textContent=
      "私人數據研究室 V5.1";
  }

  document.title="LOTTO AI PRO V5.1";

})();
