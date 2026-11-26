(function () {
  "use strict";

  const panel = document.createElement("div");
  panel.className = "card";
  panel.innerHTML = `
    <h2>組合覆蓋研究 V6.0</h2>
    <p>四種組合配置與隨機基準比較</p>
    <p>歷史測試期數</p>
    <select id="optPeriod">
      <option value="50">最近50期</option>
      <option value="100" selected>最近100期</option>
      <option value="150">最近150期</option>
      <option value="200">最近200期</option>
    </select>
    <p>重複實驗次數</p>
    <select id="optRepeat">
      <option value="5">5次</option>
      <option value="10" selected>10次</option>
      <option value="20">20次</option>
    </select>
    <button id="optRun">開始組合覆蓋研究</button>
    <p id="optStatus"></p>
    <div id="optResult"></div>
    <p>僅供歷史模擬研究，實際投注 NT$0。</p>
  `;
  document.body.appendChild(panel);

  function rng(seed) {
    let x = seed >>> 0;
    return function () {
      x = (Math.imul(x,1664525)
        + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function shuffle(a,r) {
    a = [...a];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(r()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  const universe=Array.from(
    {length:49},(_,i)=>i+1
  );

  function sample(r){
    return shuffle(universe,r)
      .slice(0,6).sort((a,b)=>a-b);
  }

  function keys(a){
    const p=[],t=[];
    for(let i=0;i<a.length;i++){
      for(let j=i+1;j<a.length;j++){
        p.push(a[i]*50+a[j]);
        for(let k=j+1;k<a.length;k++){
          t.push(a[i]*2500+a[j]*50+a[k]);
        }
      }
    }
    return {p,t};
  }

  function coverage(groups){
    const n=new Set();
    const p=new Set();
    const t=new Set();
    groups.forEach(a=>{
      a.forEach(x=>n.add(x));
      const k=keys(a);
      k.p.forEach(x=>p.add(x));
      k.t.forEach(x=>t.add(x));
    });
    return [n.size,p.size,t.size];
  }

  function uniqueGroups(r,make){
    const groups=[],seen=new Set();
    while(groups.length<8){
      const a=make(groups.length)
        .sort((a,b)=>a-b);
      const key=a.join(",");
      if(!seen.has(key)){
        seen.add(key);
        groups.push(a);
      }
    }
    return groups;
  }

  function generate(mode,r){
    if(mode==="A"){
      return uniqueGroups(r,()=>sample(r));
    }

    if(mode==="H"){
      const pool=shuffle(universe,r);
      return Array.from({length:8},(_,i)=>
        pool.slice(i*6,i*6+6)
        .sort((a,b)=>a-b));
    }

    if(mode==="I"){
      const groups=[];
      const seen=new Set();
      const p=new Set(),t=new Set();
      for(let i=0;i<8;i++){
        let best=null,bestScore=-Infinity;
        for(let j=0;j<80;j++){
          const a=sample(r);
          if(seen.has(a.join(",")))continue;
          const k=keys(a);
          const score=
            k.t.filter(x=>!t.has(x)).length*3+
            k.p.filter(x=>!p.has(x)).length;
          if(score>bestScore){
            best=a;
            bestScore=score;
          }
        }
        if(!best)throw Error("模擬失敗");
        groups.push(best);
        seen.add(best.join(","));
        const k=keys(best);
        k.p.forEach(x=>p.add(x));
        k.t.forEach(x=>t.add(x));
      }
      return groups;
    }

    const core=shuffle(universe,r).slice(0,3);
    const rest=universe.filter(
      n=>!core.includes(n)
    );

    return uniqueGroups(r,i=>{
      if(mode==="J" || i<4){
        return [...core,
          ...shuffle(rest,r).slice(0,3)];
      }
      return sample(r);
    });
  }

  function run(){
    const status=document.getElementById(
      "optStatus");
    const result=document.getElementById(
      "optResult");

    try{
      if(typeof db==="undefined" ||
         !db.lotto649){
        throw Error("大樂透資料尚未載入");
      }

      const rows=[...db.lotto649.rows]
        .sort((a,b)=>
          a.date.localeCompare(b.date));

      const periods=Number(
        document.getElementById(
          "optPeriod").value);

      const repeat=Number(
        document.getElementById(
          "optRepeat").value);

      if(rows.length<periods)
        throw Error("歷史資料不足");

      const test=rows.slice(-periods);

      const models=[
        ["A","隨機基準"],
        ["H","廣泛覆蓋"],
        ["I","組合覆蓋"],
        ["J","核心集中"],
        ["K","混合配置"]
      ];

      const output=[];

      models.forEach(([mode,name])=>{
        let total=0,rounds=0;
        let hit3=0,hit4=0;
        let nums=0,pairs=0,triples=0;
        let round3=0;

        test.forEach((row,i)=>{
          for(let j=0;j<repeat;j++){
            const r=rng(
              20261126+i*7919+j*104729
            );
            const groups=generate(mode,r);
            const c=coverage(groups);

            nums+=c[0];
            pairs+=c[1];
            triples+=c[2];

            let maxHit=0;

            groups.forEach(a=>{
              const h=a.filter(n=>
                row.nums.includes(n)
              ).length;
              total+=h;
              if(h>=3)hit3++;
              if(h>=4)hit4++;
              maxHit=Math.max(maxHit,h);
            });

            if(maxHit>=3)round3++;
            rounds++;
          }
        });

        output.push({
          mode,name,
          avg:total/(rounds*8),
          hit3:100*hit3/(rounds*8),
          hit4:100*hit4/(rounds*8),
          round3:100*round3/rounds,
          nums:nums/rounds,
          pairs:pairs/rounds,
          triples:triples/rounds
        });
      });

      let html=`
        <h2>組合覆蓋研究結果</h2>
        <p>有效測試：${test.length}期</p>
        <p>每模型：${test.length*repeat*8}組</p>
        <p>固定隨機種子：20261126</p>
        <table>
        <tr>
          <th>模型</th>
          <th>平均命中</th>
          <th>3碼以上</th>
        </tr>
      `;

      output.forEach(s=>{
        html+=`
          <tr>
            <td>${s.mode} ${s.name}</td>
            <td>${s.avg.toFixed(3)}</td>
            <td>${s.hit3.toFixed(2)}%</td>
          </tr>`;
      });

      html+="</table>";

      output.forEach(s=>{
        html+=`
          <details>
          <summary>${s.mode} ${s.name}</summary>
          <p>平均命中：${s.avg.toFixed(3)}碼</p>
          <p>單組3碼以上：${s.hit3.toFixed(2)}%</p>
          <p>單組4碼以上：${s.hit4.toFixed(2)}%</p>
          <p>每輪至少一組3碼以上：
            ${s.round3.toFixed(2)}%</p>
          <p>不同號碼：
            ${s.nums.toFixed(1)} / 48</p>
          <p>不同兩碼組合：
            ${s.pairs.toFixed(1)} / 120</p>
          <p>不同三碼組合：
            ${s.triples.toFixed(1)} / 160</p>
          </details>`;
      });

      html+=`
        <p>公平隨機理論平均命中：0.735碼</p>
        <p>重複模擬不等於新增開獎樣本。
        覆蓋率不同不代表頭獎機率提高。</p>
        <p>實際投注支出：NT$0</p>
      `;

      result.innerHTML=html;
      status.textContent="組合覆蓋研究完成";

    }catch(e){
      status.textContent="錯誤："+e.message;
    }
  }

  document.getElementById(
    "optRun").addEventListener("click",()=>{
      document.getElementById(
        "optStatus").textContent="研究運算中...";
      setTimeout(run,30);
    });

})();
