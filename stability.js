 (function () {
  "use strict";

  const panel = document.createElement("div");
  panel.className = "card";

  panel.innerHTML = `
    <h2>模型穩定性驗證 V6.1</h2>
    <p>不同歷史區段獨立比較</p>

    <p>每區段測試期數</p>
    <select id="stBlock">
      <option value="30">30期</option>
      <option value="50" selected>50期</option>
      <option value="100">100期</option>
    </select>

    <p>重複實驗次數</p>
    <select id="stRepeat">
      <option value="5">5次</option>
      <option value="10" selected>10次</option>
      <option value="20">20次</option>
    </select>

    <button id="stRun">開始穩定性驗證</button>
    <p id="stStatus"></p>
    <div id="stResult"></div>
    <p>僅供統計研究，實際投注 NT$0。</p>
  `;

  document.body.appendChild(panel);

  const universe = Array.from(
    {length:49}, (_,i)=>i+1
  );

  function rng(seed){
    let x=seed>>>0;
    return ()=>{
      x=(Math.imul(x,1664525)
        +1013904223)>>>0;
      return x/4294967296;
    };
  }

  function shuffle(a,r){
    a=[...a];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(r()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

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

  function generate(mode,r){
    if(mode==="H"){
      const pool=shuffle(universe,r);
      return Array.from({length:8},(_,i)=>
        pool.slice(i*6,i*6+6)
        .sort((a,b)=>a-b));
    }

    const groups=[],seen=new Set();
    const p=new Set(),t=new Set();
    const core=(mode==="J" || mode==="K")
      ?shuffle(universe,r).slice(0,3):[];
    const rest=universe.filter(
      n=>!core.includes(n)
    );

    while(groups.length<8){
      let a;

      if(mode==="I"){
        let best=null,score=-Infinity;

        for(let j=0;j<80;j++){
          const c=sample(r);
          if(seen.has(c.join(",")))continue;
          const k=keys(c);

          const s=
            k.t.filter(x=>!t.has(x)).length*3+
            k.p.filter(x=>!p.has(x)).length;

          if(s>score){
            best=c;
            score=s;
          }
        }

        if(!best)throw Error("模擬失敗");
        a=best;

      }else if(mode==="J" ||
        (mode==="K" && groups.length<4)){

        a=[...core,
          ...shuffle(rest,r).slice(0,3)]
          .sort((a,b)=>a-b);

      }else{
        a=sample(r);
      }

      const key=a.join(",");
      if(seen.has(key))continue;

      seen.add(key);
      groups.push(a);

      const k=keys(a);
      k.p.forEach(x=>p.add(x));
      k.t.forEach(x=>t.add(x));
    }

    return groups;
  }

  function run(){
    const status=document.getElementById(
      "stStatus");
    const result=document.getElementById(
      "stResult");

    try{
      if(typeof db==="undefined" ||
         !db.lotto649){
        throw Error("大樂透資料尚未載入");
      }

      const rows=[...db.lotto649.rows]
        .sort((a,b)=>
          a.date.localeCompare(b.date));

      const size=Number(
        document.getElementById("stBlock").value);

      const repeat=Number(
        document.getElementById("stRepeat").value);

      const count=Math.floor(rows.length/size);

      if(count<2)
        throw Error("歷史區段不足");

      const models=[
        ["A","隨機基準"],
        ["H","廣泛覆蓋"],
        ["I","組合覆蓋"],
        ["J","核心集中"],
        ["K","混合配置"]
      ];

      const summary={};

      models.forEach(([m])=>{
        summary[m]={
          sum:0,
          positive:0,
          round3:0,
          total:0
        };
      });

      let html=`
        <h2>穩定性驗證結果</h2>
        <p>獨立歷史區段：${count}段</p>
        <p>每區段：${size}期</p>
        <p>使用資料：${count*size}期</p>
        <p>未納入最早資料：
          ${rows.length-count*size}期</p>
      `;

      for(let b=0;b<count;b++){
        const end=rows.length-b*size;
        const start=end-size;
        const block=rows.slice(start,end);
        let baseline=0;

        html+=`
          <details>
          <summary>區段 ${b+1}：
          ${block[0].date} ～
          ${block[block.length-1].date}</summary>
          <table>
          <tr>
            <th>模型</th>
            <th>平均命中</th>
            <th>每輪3碼以上</th>
          </tr>
        `;

        models.forEach(([mode,name])=>{
          let hits=0,round3=0;

          block.forEach((row,i)=>{
            for(let j=0;j<repeat;j++){

              const r=rng(
                20261126+
                (start+i)*7919+j*104729
              );

              const groups=generate(mode,r);
              let max=0;

              groups.forEach(a=>{
                const h=a.filter(n=>
                  row.nums.includes(n)
                ).length;
                hits+=h;
                max=Math.max(max,h);
              });

              if(max>=3)round3++;
            }
          });

          const avg=hits/(size*repeat*8);
          const rate=100*round3/(size*repeat);

          if(mode==="A")baseline=avg;

          summary[mode].sum+=avg;
          summary[mode].round3+=rate;
          summary[mode].total++;

          if(mode!=="A" && avg>baseline){
            summary[mode].positive++;
          }

          html+=`
            <tr>
              <td>${mode} ${name}</td>
              <td>${avg.toFixed(3)}</td>
              <td>${rate.toFixed(2)}%</td>
            </tr>
          `;
        });

        html+="</table></details>";
      }

      html+=`
        <h2>跨區段穩定性總覽</h2>
        <table>
          <tr>
            <th>模型</th>
            <th>平均命中</th>
            <th>高於隨機區段</th>
          </tr>
      `;

      models.forEach(([mode,name])=>{
        const s=summary[mode];

        html+=`
          <tr>
            <td>${mode} ${name}</td>
            <td>${(s.sum/s.total).toFixed(3)}</td>
            <td>${mode==="A"?"基準":
              s.positive+" / "+s.total}</td>
          </tr>
        `;
      });

      html+="</table>";

      html+="<h2>每輪至少一組3碼以上</h2>";

      models.forEach(([mode,name])=>{
        const s=summary[mode];

        html+=`
          <p>${mode} ${name}：
          ${(s.round3/s.total).toFixed(2)}%</p>
        `;
      });

      html+=`
        <p>公平隨機理論平均：0.735碼</p>
        <p>各區段不重複，但不保證統計獨立。
        高於隨機的區段數僅為描述性統計，
        並非顯著性檢定。</p>
        <p>歷史表現不代表未來中獎優勢。</p>
        <p>實際投注支出：NT$0</p>
      `;

      result.innerHTML=html;
      status.textContent="穩定性驗證完成";

    }catch(e){
      status.textContent="錯誤："+e.message;
    }
  }

  document.getElementById("stRun")
    .addEventListener("click",()=>{
      document.getElementById("stStatus")
        .textContent="研究運算中...";
      setTimeout(run,30);
    });

})();