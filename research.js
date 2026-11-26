
(function () {
  "use strict";

  const key = "lotto_research_v7";
  const panel = document.createElement("div");
  panel.className = "card";

  panel.innerHTML = `
    <h2>綜合研究中心 V7.0</h2>
    <p>模型研究紀錄與理論機率比較</p>

    <p>研究模型</p>
    <select id="rModel">
      <option>A 隨機基準</option>
      <option>B 冷熱週期</option>
      <option>C 兩碼三碼關聯</option>
      <option>D 最近三期留號</option>
      <option>E 威力彩連動</option>
      <option>F 今彩539連動</option>
      <option>G 綜合模型</option>
      <option>H 廣泛覆蓋</option>
      <option>I 組合覆蓋</option>
      <option>J 核心集中</option>
      <option>K 混合配置</option>
    </select>

    <p>測試期數</p>
    <input id="rPeriods" type="number"
      min="1" value="100">

    <p>平均命中碼數</p>
    <input id="rAvg" type="number"
      min="0" max="6" step="0.001">

    <p>單組3碼以上比例 (%)</p>
    <input id="rHit" type="number"
      min="0" max="100" step="0.01">

    <p>實驗設定與備註</p>
    <textarea id="rNote"
      placeholder="訓練期數、測試區段、隨機種子">
    </textarea>

    <button id="rSave">儲存研究結果</button>
    <p id="rStatus"></p>
    <div id="rTheory"></div>
    <div id="rResult"></div>
    <button id="rExport">匯出研究紀錄</button>
    <button id="rClear">清除研究紀錄</button>
    <p>僅供統計研究，實際投注 NT$0。</p>
  `;

  document.body.appendChild(panel);

  const el = id => document.getElementById(id);

  panel.querySelectorAll("input,textarea").forEach(x => {
    x.style.cssText = "width:100%;box-sizing:border-box;padding:12px;background:#111827;color:white;border:1px solid #64748b;border-radius:10px;font-size:16px;";
  });

  function choose(n,k){
    if(k<0 || k>n)return 0;
    let v=1;
    for(let i=1;i<=k;i++){
      v=v*(n-i+1)/i;
    }
    return Math.round(v);
  }

  const total=choose(49,6);
  const theory=36/49;
  const p3=[3,4,5,6].reduce((s,k)=>
    s+choose(6,k)*choose(43,6-k)/total,0
  );

  el("rTheory").innerHTML=`
    <h2>公平隨機理論基準</h2>
    <p>平均命中：${theory.toFixed(4)}碼</p>
    <p>單組3碼以上：
      ${(p3*100).toFixed(4)}%</p>
    <p>單組頭獎機率：1 / ${total.toLocaleString()}</p>
  `;

  function read(){
    return JSON.parse(
      localStorage.getItem(key)||"[]"
    );
  }

  function render(){
    const result=el("rResult");
    result.innerHTML="<h2>歷史研究紀錄</h2>";

    let rows;
    try{
      rows=read();
    }catch(e){
      el("rStatus").textContent="無法讀取紀錄";
      return;
    }

    if(!rows.length){
      result.append("尚未儲存研究結果");
      return;
    }

    rows.slice().reverse().forEach(r=>{
      const detail=document.createElement("details");
      const title=document.createElement("summary");
      title.textContent=r.model+"｜"+r.date;
      detail.appendChild(title);

      [
        "測試期數："+r.periods,
        "平均命中："+r.avg.toFixed(3),
        "與理論差距："+(r.avg-theory).toFixed(3),
        "單組3碼以上："+r.hit.toFixed(2)+"%",
        "備註："+r.note
      ].forEach(t=>{
        const p=document.createElement("p");
        p.textContent=t;
        detail.appendChild(p);
      });

      result.appendChild(detail);
    });
  }

  el("rSave").onclick=()=>{
    try{
      const periods=Number(el("rPeriods").value);
      const avg=Number(el("rAvg").value);
      const hit=Number(el("rHit").value);

      if(!el("rAvg").value ||
         !el("rHit").value ||
         !Number.isInteger(periods) ||
         periods<1 ||
         !Number.isFinite(avg) ||
         avg<0 || avg>6 ||
         !Number.isFinite(hit) ||
         hit<0 || hit>100){
        throw Error("請輸入有效的研究數據");
      }

      const rows=read();

      rows.push({
        date:new Date().toLocaleString("zh-TW"),
        model:el("rModel").value,
        periods,
        avg,
        hit,
        note:el("rNote").value.trim()
      });

      localStorage.setItem(
        key,JSON.stringify(rows)
      );

      el("rStatus").textContent="研究結果已儲存";
      render();

    }catch(e){
      el("rStatus").textContent=e.message;
    }
  };

  el("rExport").onclick=()=>{
    try{
      const blob=new Blob(
        [JSON.stringify(read(),null,2)],
        {type:"application/json"}
      );

      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download="lotto-research-v7.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>{
        URL.revokeObjectURL(url);
      },1000);

    }catch(e){
      el("rStatus").textContent=e.message;
    }
  };

  el("rClear").onclick=()=>{
    if(confirm("確定清除所有研究紀錄？")){
      localStorage.removeItem(key);
      render();
    }
  };

  render();

})();
