(function(){
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var CHECK='<svg class="i14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>';
  var state={screen:1,warnDismissed:false,data:[],attempts:0,feedback:'idle'};

  /* SIMULACIÓN */
  function runSim(p){
    var T0=parseFloat(p.T0),Tamb=parseFloat(p.Tamb),k=parseFloat(p.k),tF=parseFloat(p.tFinal),h=parseFloat(p.h);
    if([T0,Tamb,k,tF,h].some(function(v){return !isFinite(v)})||h<=0||tF<=0||k<=0)return[];
    var steps=Math.round(tF/h);
    if(!isFinite(steps)||steps<1||steps>10000)return[];
    var rows=[],eT=T0,mT=T0,rT=T0;
    var f=function(T){return -k*(T-Tamb)};
    for(var i=0;i<=steps;i++){
      var t=parseFloat((i*h).toFixed(8));
      var ex=Tamb+(T0-Tamb)*Math.exp(-k*t);
      rows.push({
        t:t,
        exact:ex,
        euler:eT,
        eulerErr:Math.abs(eT-ex),
        modified:mT,
        modifiedErr:Math.abs(mT-ex),
        rk4:rT,
        rk4Err:Math.abs(rT-ex)
      });
      if(i<steps){
        eT=eT+h*f(eT);
        var predictor=mT+h*f(mT);
        mT=mT+(h/2)*(f(mT)+f(predictor));
        var k1=f(rT),k2=f(rT+h/2*k1),k3=f(rT+h/2*k2),k4=f(rT+h*k3);
        rT=rT+h/6*(k1+2*k2+2*k3+k4);
      }
    }
    return rows;
  }

  /* NAVEGACIÓN */
  function setScreen(n){
    state.screen=n;
    $$('.screen').forEach(function(s){s.hidden=Number(s.dataset.screen)!==n});
    $$('[data-step]').forEach(function(el){
      var num=Number(el.dataset.step),dot=$('[data-dot]',el),lbl=$('[data-lbl]',el);
      var done=num<n,act=num===n;
      dot.className='step-dot'+((done||act)?' on':'');
      dot.innerHTML=done?CHECK:String(num);
      lbl.className='step-lbl'+((done||act)?' on':'');
    });
    $$('[data-line]').forEach(function(el){
      var num=Number(el.dataset.line);
      el.className='step-line'+(num<n?' on':'');
    });
    $('#btn-back').disabled=n===1;
    window.scrollTo({top:0,behavior:'smooth'});
  }

  /* GRÁFICO */
  function buildSVG(data){
    var W=560,H=240,PL=52,PR=16,PT=16,PB=36;
    var tMax=data[data.length-1].t||1;
    var minT=Infinity,maxT=-Infinity;
    data.forEach(function(r){
      if(r.exact<minT)minT=r.exact; if(r.euler<minT)minT=r.euler; if(r.modified<minT)minT=r.modified; if(r.rk4<minT)minT=r.rk4;
      if(r.exact>maxT)maxT=r.exact; if(r.euler>maxT)maxT=r.euler; if(r.modified>maxT)maxT=r.modified; if(r.rk4>maxT)maxT=r.rk4;
    });
    var rangeT=(maxT-minT)||1;
    var toX=function(t){return PL+(t/tMax)*(W-PL-PR)};
    var toY=function(T){return PT+(1-(T-minT)/rangeT)*(H-PT-PB)};
    var stride=Math.max(1,Math.ceil(data.length/400));
    var poly=function(key){
      var pts=[];
      for(var i=0;i<data.length;i+=stride)pts.push(toX(data[i].t).toFixed(1)+','+toY(data[i][key]).toFixed(1));
      var last=data[data.length-1];
      pts.push(toX(last.t).toFixed(1)+','+toY(last[key]).toFixed(1));
      return pts.join(' ');
    };
    var s='<svg viewBox="0 0 '+W+' '+H+'" class="chart-svg" style="width:100%;height:100%">';
    for(var i=0;i<=5;i++){
      var v=minT+(i/5)*rangeT,y=toY(v);
      s+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="#e2e8f0" stroke-width="1"/>';
      s+='<text x="'+(PL-4)+'" y="'+(y+3.5)+'" text-anchor="end" font-size="9" fill="#94a3b8" font-family="monospace">'+v.toFixed(0)+'</text>';
    }
    for(var i=0;i<=6;i++){
      var v2=(i/6)*tMax,x2=toX(v2);
      s+='<line x1="'+x2+'" y1="'+PT+'" x2="'+x2+'" y2="'+(H-PB)+'" stroke="#e2e8f0" stroke-width="1"/>';
      s+='<text x="'+x2+'" y="'+(H-PB+13)+'" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="monospace">'+v2.toFixed(1)+'</text>';
    }
    s+='<polyline points="'+poly('exact')+'" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    s+='<polyline points="'+poly('euler')+'" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="6 3"/>';
    s+='<polyline points="'+poly('modified')+'" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray="5 2"/>';
    s+='<polyline points="'+poly('rk4')+'" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="2 2"/>';
    s+='<line x1="'+PL+'" y1="'+PT+'" x2="'+PL+'" y2="'+(H-PB)+'" stroke="#cbd5e1" stroke-width="1.5"/>';
    s+='<line x1="'+PL+'" y1="'+(H-PB)+'" x2="'+(W-PR)+'" y2="'+(H-PB)+'" stroke="#cbd5e1" stroke-width="1.5"/>';
    s+='<text x="'+(PL+(W-PL-PR)/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="10" fill="#64748b">Tiempo t (min)</text>';
    var cy=PT+(H-PT-PB)/2;
    s+='<text x="12" y="'+cy+'" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-90, 12, '+cy+')">T (°C)</text>';
    s+='</svg>';
    return s;
  }

  var fmt=function(n,d){return Number(n).toFixed(d===undefined?4:d)};

  function renderResults(){
    var data=state.data, box=$('#chart-box'), scroll=$('#tbl-scroll'),
        foot=$('#tbl-foot'), meta=$('#tbl-meta'), sum=$('#summary-card');

    if(!data.length){
      $('#btn-csv').disabled=true;
      box.innerHTML='<div class="chart-ph"><svg class="ph-x" preserveAspectRatio="none"><line x1="0" y1="0" x2="100%" y2="100%" stroke="#e2e8f0" stroke-width="1.5"/><line x1="100%" y1="0" x2="0" y2="100%" stroke="#e2e8f0" stroke-width="1.5"/></svg><div class="ph-lbl"><p class="ph-title">Gráfico de Líneas 2D</p><p class="ph-sub">Ejecuta la simulación para generar</p></div></div>';
      scroll.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18M7 16l4-4 4 4 4-8"/></svg><p>Sin datos — ejecuta la simulación primero</p></div>';
      foot.hidden=true; meta.hidden=true; sum.hidden=true; return;
    }
    $('#btn-csv').disabled=false;
    box.innerHTML=buildSVG(data);

    var shown=data.slice(0,30);
    var h='<table class="tbl"><thead><tr>'+
      '<th>t (min)</th><th>Exacta (°C)</th><th>Euler Explícito (°C)</th><th>|Error| Euler</th><th>Euler Modificado (°C)</th><th>|Error| Euler Modificado</th><th>RK4 (°C)</th><th>|Error| RK4</th>'+
      '</tr></thead><tbody>';
    shown.forEach(function(r){
      var eCls=r.eulerErr>1?'bad':(r.eulerErr>0.1?'warn':'muted');
      var mCls=r.modifiedErr>1?'bad':(r.modifiedErr>0.1?'warn':'muted');
      var rCls=r.rk4Err>0.01?'warn':'good';
      var rTxt=r.rk4Err<1e-10?'&lt; 1e-10':fmt(r.rk4Err);
      h+='<tr>'+
        '<td class="cell-t">'+r.t.toFixed(2)+'</td>'+
        '<td class="cell-ex">'+fmt(r.exact)+'</td>'+
        '<td class="cell-eu">'+fmt(r.euler)+'</td>'+
        '<td class="cell-err '+eCls+'">'+fmt(r.eulerErr)+'</td>'+
        '<td class="cell-mod">'+fmt(r.modified)+'</td>'+
        '<td class="cell-err '+mCls+'">'+fmt(r.modifiedErr)+'</td>'+
        '<td class="cell-rk">'+fmt(r.rk4)+'</td>'+
        '<td class="cell-err '+rCls+'">'+rTxt+'</td>'+
      '</tr>';
    });
    h+='</tbody></table>';
    scroll.innerHTML=h;

    meta.hidden=false;
    meta.textContent=data.length+' filas · paso h = '+$('#h').value+' min';

    if(data.length>30){foot.hidden=false;foot.textContent='Mostrando las primeras 30 de '+data.length+' filas · reduce t_final o aumenta h para ver todas';}
    else foot.hidden=true;

    var last=data[data.length-1];
    sum.hidden=false;
    $('#sum-t').textContent=last.t.toFixed(2);
    $('#sum-exact').textContent=fmt(last.exact)+' °C';
    var eu=$('#sum-euler');
    eu.textContent=fmt(last.eulerErr)+' °C';
    eu.className='sum-value '+(last.eulerErr>1?'red':'orange');
    $('#sum-modified').textContent=fmt(last.modifiedErr)+' °C';
    $('#sum-rk4').textContent=last.rk4Err<1e-10?'< 1×10⁻¹⁰ °C':fmt(last.rk4Err)+' °C';
  }

  function clearResults(){state.data=[];renderResults()}

  function updateStability(){
    var h=parseFloat($('#h').value), k=parseFloat($('#k').value);
    var unstable=Number.isFinite(h)&&Number.isFinite(k)&&k>0&&h>=2/k;
    var bound=!Number.isFinite(k)||k<=0?'—':(2/k).toFixed(3);
    $('#h').classList.toggle('warn',unstable);
    $('#stab-bound').textContent=bound;
    $('#stab-current').textContent=$('#h').value;
    $('#stability-warning').hidden=!unstable||state.warnDismissed;
  }

  /* RETROALIMENTACIÓN */
  var CORRECT=3.8588, TOL=0.01;

  function feedbackHTML(){
    var f=state.feedback;
    if(f==='idle'){
      return '<div><div class="sk-line"></div><div class="sk-line"></div><div class="sk-line"></div><div class="sk-line"></div><p class="sk-note">Envía tu respuesta para recibir retroalimentación</p></div>';
    }
    if(f==='correct'){
      return '<div class="fb"><div class="fb-icon g"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"/></svg></div><div><p class="fb-title g">¡Respuesta correcta!</p><p class="fb-text g">El LTE de Euler Explícito en t = 0 se calcula a partir de la expansión de Taylor:</p><div class="fml fml-ok">LTE = (h²/2) · k² · (T₀ − T_amb)<br>&nbsp;&nbsp;&nbsp;&nbsp;= (1²/2) · (0.35²) · (85 − 22)<br>&nbsp;&nbsp;&nbsp;&nbsp;= 0.5 · 0.1225 · 63 = <strong>3.8588 °C</strong></div><p class="fb-text g">Este término dominante O(h²) confirma la precisión global O(h) para Euler. RK4 tiene LTE O(h⁵) → global O(h⁴).</p></div></div>';
    }
    if(f==='close'){
      var ans=$('#answer-input').value;
      return '<div class="fb"><div class="fb-icon o"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg></div><div><p class="fb-title o">Muy cerca — revisa tu aritmética.</p><p class="fb-text o">Tu respuesta <strong>'+ans+'</strong> está dentro de 0.5 °C del valor correcto. Verifica si usaste k = 0.35 (no k² = 0.35) y (T₀ − T_amb) = 63 correctamente.</p><p class="fb-hint o">Pista: LTE = (h²/2) · k² · ΔT → (0.5)(0.1225)(63)</p></div></div>';
    }
    var reveal=state.attempts>=3?('Respuesta correcta: '+CORRECT.toFixed(4)+' °C'):'(La respuesta se revela tras 3 intentos)';
    return '<div class="fb"><div class="fb-icon r"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"/></svg></div><div><p class="fb-title r">Incorrecto. Revisa la deducción.</p><p class="fb-text r">Parte de la expansión de Taylor de la solución exacta alrededor de tₙ:</p><div class="fml fml-err">T(tₙ + h) = T(tₙ) + h·T\'(tₙ) + (h²/2)·T\'\'(tₙ) + O(h³)</div><p class="fb-hint r">Euler predice T̂ = T(tₙ) + h·T\'(tₙ), por lo tanto LTE = (h²/2)·T\'\'(tₙ). '+reveal+'</p></div></div>';
  }

  function renderFeedback(){
    var box=$('#feedback');
    box.dataset.state=state.feedback;
    $('#feedback-body').innerHTML=feedbackHTML();
    var note=$('#attempts');
    if(state.attempts>0&&state.feedback!=='correct'){
      note.hidden=false;
      note.textContent='Intento '+state.attempts+(state.attempts>=3?' · Solución completa mostrada en el panel de retroalimentación':'');
    } else note.hidden=true;
  }

  function verifyAnswer(){
    var val=parseFloat($('#answer-input').value);
    state.attempts++;
    if(isNaN(val))state.feedback='wrong';
    else{
      var err=Math.abs(val-CORRECT);
      state.feedback=err<=TOL?'correct':(err<=0.5?'close':'wrong');
    }
    renderFeedback();
  }

  function descargarCsv(){
    if(!state.data.length)return;
    var headers=['t (min)','Exacta (°C)','Euler Explícito (°C)','Error Euler (°C)','Euler Modificado (°C)','Error Euler Modificado (°C)','RK4 (°C)','Error RK4 (°C)'];
    var escapar=function(value){return '"'+String(value).replace(/"/g,'""')+'"';};
    var rows=state.data.map(function(row){
      return [row.t,row.exact,row.euler,row.eulerErr,row.modified,row.modifiedErr,row.rk4,row.rk4Err];
    });
    var contenido='\ufeff'+[headers].concat(rows).map(function(row){
      return row.map(escapar).join(',');
    }).join('\r\n');
    var url=URL.createObjectURL(new Blob([contenido],{type:'text/csv;charset=utf-8'}));
    var enlace=document.createElement('a');
    enlace.href=url;
    enlace.download='resultados_edo.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }

  /* INICIO */
  function init(){
    document.addEventListener('click',function(e){
      var g=e.target.closest('[data-goto]');
      if(g)setScreen(Number(g.dataset.goto));
    });
    $('#btn-back').addEventListener('click',function(){if(state.screen>1)setScreen(state.screen-1)});

    ['T0','Tamb','k','tFinal','h'].forEach(function(id){
      $('#'+id).addEventListener('input',function(){
        state.warnDismissed=false;
        $('#sim-error').hidden=true;
        updateStability();
        clearResults();
      });
    });

    $('#btn-dismiss-warning').addEventListener('click',function(){
      state.warnDismissed=true;
      updateStability();
    });

    $('#btn-run').addEventListener('click',function(){
      var p={};
      ['T0','Tamb','k','tFinal','h'].forEach(function(id){p[id]=$('#'+id).value});
      state.data=runSim(p);
      $('#sim-error').textContent=state.data.length?'':'Revisa los parámetros: deben ser números válidos, positivos cuando corresponda y producir como máximo 10 000 pasos.';
      $('#sim-error').hidden=state.data.length>0;
      renderResults();
    });
    $('#btn-csv').addEventListener('click',descargarCsv);

    var ai=$('#answer-input');
    ai.addEventListener('input',function(){state.feedback='idle';renderFeedback()});
    ai.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();verifyAnswer()}});
    $('#btn-verify').addEventListener('click',verifyAnswer);

    setScreen(window.location.hash==='#tema15'?2:1);
    updateStability();
    renderResults();
    renderFeedback();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
