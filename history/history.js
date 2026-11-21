(function(){
'use strict';

var SERVICE=window.LYNK_SERVICE||null;
var OWNER='LynkByte',REPO='lynkdesk-status';
var RAW='https://raw.githubusercontent.com/'+OWNER+'/'+REPO+'/master/';
var GRAPHS='https://raw.githubusercontent.com/'+OWNER+'/'+REPO+'/master/graphs/';
var SITES=[
  {slug:'corporate-website',name:'Corporate website',url:'https://lynkbyte.com'},
  {slug:'web-app',name:'Web app',url:'https://app.lynkbyte.com/up'},
  {slug:'api',name:'API',url:'https://api.lynkbyte.com/api/health'},
  {slug:'database-and-cache',name:'Database and cache',url:'https://app.lynkbyte.com/health/deep'}
];
var PERIODS=[['day','24 hours'],['week','7 days'],['month','30 days'],['year','1 year'],['all','All time']];
var LAB={up:'Working',degraded:'Slower than usual',down:'Not working',none:'No data yet'};
var CHIP={up:'ok',degraded:'deg',down:'out',none:'none'};

var state={summary:null,histories:{},hourly:null,period:'week',hourFilter:24,error:false};

function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rel(ts){
  if(!ts) return 'never';
  var d=Date.now()-ts;
  if(d<60000) return 'just now';
  var m=Math.floor(d/60000);
  if(m<60) return m+' min ago';
  var h=Math.floor(m/60);
  if(h<24) return h+(h===1?' hour ago':' hours ago');
  var days=Math.floor(h/24);
  return days+(days===1?' day ago':' days ago');
}
function fmtDate(ts){return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function fmtTime(ts){return new Date(ts).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});}
function siteFor(slug){for(var i=0;i<SITES.length;i++) if(SITES[i].slug===slug) return SITES[i]; return null;}
function summaryFor(slug){
  if(!Array.isArray(state.summary)) return null;
  for(var i=0;i<state.summary.length;i++) if(state.summary[i]&&state.summary[i].slug===slug) return state.summary[i];
  return null;
}
function parseYml(text){
  var out={};
  text.split(/\r?\n/).forEach(function(line){
    var m=line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if(m) out[m[1]]=m[2];
  });
  return out;
}
function fetchText(url){
  return fetch(url,{cache:'no-store'}).then(function(r){
    if(!r.ok) throw new Error(url+' returned '+r.status);
    return r.text();
  });
}
function fetchJSON(url){
  return fetch(url,{cache:'no-store'}).then(function(r){
    if(!r.ok) throw new Error(url+' returned '+r.status);
    return r.json();
  });
}

function statusOf(slug){
  var h=state.histories[slug];
  if(h&&h.status) return h.status;
  var s=summaryFor(slug);
  return s&&s.status?s.status:'none';
}
function uptimeKey(p){return p==='all'?'uptime':'uptime'+p.charAt(0).toUpperCase()+p.slice(1);}
function timeKey(p){return p==='all'?'time':'time'+p.charAt(0).toUpperCase()+p.slice(1);}

function renderIndex(){
  var rows=SITES.map(function(s){
    var st=statusOf(s.slug),sum=summaryFor(s.slug);
    var up=sum?(sum.uptimeMonth||sum.uptime||'—'):'—';
    return '<a class="service" href="/history/'+s.slug+'/">'+
      '<span><b>'+esc(s.name)+'</b><span class="url">'+esc(s.url)+'</span></span>'+
      '<span class="right"><span class="up">'+esc(up)+'<small>last 30 days</small></span>'+
      '<span class="chip c-'+(CHIP[st]||'none')+'"><i></i>'+esc(LAB[st]||LAB.none)+'</span>'+
      '<span class="go" aria-hidden="true">→</span></span></a>';
  }).join('');
  $('app').innerHTML='<div class="card list">'+rows+'</div>';
}

function renderService(){
  var s=siteFor(SERVICE);
  if(!s){$('app').innerHTML='<div class="card"><p class="muted">Unknown service.</p></div>';return;}
  var h=state.histories[SERVICE]||{},sum=summaryFor(SERVICE)||{};
  var st=h.status||sum.status||'none';
  var p=state.period;
  var uk=uptimeKey(p),tk=timeKey(p);
  var up=sum[uk]||'—';
  var time=sum[tk]!=null?sum[tk]+' ms':'—';
  var chart=GRAPHS+SERVICE+'/response-time'+(p==='all'?'':'-'+p)+'.png';
  var meta=[];
  if(h.lastUpdated) meta.push('<span class="mono">Status since '+esc(fmtTime(h.lastUpdated))+' · '+esc(rel(new Date(h.lastUpdated).getTime()))+'</span>');
  if(h.startTime) meta.push('<span class="mono">Tracking since '+esc(fmtDate(h.startTime))+'</span>');
  if(h.code) meta.push('<span class="mono">HTTP '+esc(h.code)+'</span>');
  if(h.responseTime) meta.push('<span class="mono">'+esc(h.responseTime)+' ms last recorded</span>');

  var tableRows=PERIODS.map(function(row){
    var key=row[0];
    return '<tr><td>'+esc(row[1])+'</td><td>'+esc(sum[uptimeKey(key)]||'—')+'</td><td>'+esc(sum[timeKey(key)]!=null?sum[timeKey(key)]+' ms':'—')+'</td></tr>';
  }).join('');

  $('app').innerHTML=
    '<section class="svc-head '+(st==='up'?'':st==='degraded'?'deg':st==='down'?'out':'none')+'">'+
      '<div><span class="chip c-'+(CHIP[st]||'none')+'"><i></i>'+esc(LAB[st]||LAB.none)+'</span>'+
      '<h1>'+esc(s.name)+'</h1><div class="url">'+esc(s.url)+'</div>'+
      '<div class="meta">'+meta.join('')+'</div></div>'+
    '</section>'+
    '<div class="seg" role="tablist" aria-label="History period">'+PERIODS.map(function(row){
      var on=row[0]===p;
      return '<button type="button" role="tab" aria-selected="'+on+'" data-p="'+row[0]+'">'+esc(row[1])+'</button>';
    }).join('')+'</div>'+
    '<div class="chart" id="chartbox"><img id="chart" src="'+esc(chart)+'" alt="'+esc('Response time for '+s.name+' over the last '+PERIODS.filter(function(x){return x[0]===p;})[0][1].toLowerCase())+'" loading="eager"></div>'+
    '<div class="stats">'+
      '<div class="stat"><b>'+esc(up)+'</b><span>Uptime · '+esc(PERIODS.filter(function(x){return x[0]===p;})[0][1])+'</span></div>'+
      '<div class="stat"><b>'+esc(time)+'</b><span>Average response</span></div>'+
      '<div class="stat"><b>'+esc(h.responseTime?h.responseTime+' ms':'—')+'</b><span>Last recorded response</span></div>'+
    '</div>'+
    '<section class="hourly">'+
      '<div class="hourly-head"><h2>Average response by hour</h2>'+
        '<div class="seg hourly-seg" role="tablist" aria-label="Hourly response period">'+[[12,'12 hours'],[24,'24 hours'],[48,'48 hours'],[168,'7 days']].map(function(row){
          return '<button type="button" role="tab" aria-selected="'+(state.hourFilter===row[0])+'" data-h="'+row[0]+'">'+row[1]+'</button>';
        }).join('')+'</div>'+
      '</div>'+
      '<div class="card">'+
        '<div id="hourly" class="hourly-chart"></div>'+
        '<div class="lab mono"><span id="hourly-start"></span><span>Now</span></div>'+
        '<p class="mono" id="hourly-summary"></p>'+
      '</div>'+
    '</section>'+
    '<div class="card"><table><thead><tr><th>Period</th><th>Uptime</th><th>Average response</th></tr></thead><tbody>'+tableRows+'</tbody></table></div>';

  var img=$('chart');
  if(img) img.addEventListener('error',function(){
    $('chartbox').innerHTML='<div class="fallback">This chart is not available yet. It is rebuilt daily and will appear after the next check.</div>';
  });
  var seg=document.querySelector('.seg');
  if(seg) seg.addEventListener('click',function(e){
    var b=e.target.closest('button[data-p]');
    if(!b) return;
    state.period=b.getAttribute('data-p');
    renderService();
  });
  renderHourly();
  bindHourlyFilter();
}

function renderHourly(){
  var chart=$('hourly');
  if(!chart) return;
  var data=state.hourly&&state.hourly.services?state.hourly.services[SERVICE]:null;
  var hours=data&&Array.isArray(data.hours)?data.hours:[];
  var map={};
  hours.forEach(function(x){map[x.hour]=x;});
  var n=state.hourFilter;
  var end=Math.floor(Date.now()/3600000)*3600000;
  var start=end-(n-1)*3600000;
  var bars=[],values=[],samples=0,peak=null;
  for(var i=0;i<n;i++){
    var t=start+i*3600000,key=new Date(t).toISOString(),item=map[key];
    var avg=item?item.avg:null,count=item?item.count:0;
    if(avg!=null){values.push(avg);samples+=count;if(!peak||avg>peak.avg) peak={avg:avg,hour:t};}
    bars.push({t:t,avg:avg,count:count});
  }
  var max=values.length?Math.max.apply(null,values):1;
  chart.innerHTML=bars.map(function(b){
    var h=b.avg!=null?Math.max(3,Math.round(b.avg/max*100)):0;
    var label=new Date(b.t).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric'});
    var title=b.avg!=null?(label+' · '+b.avg+' ms · '+b.count+' sample'+(b.count===1?'':'s')):(label+' · no sample');
    return '<div class="hb'+(b.avg==null?' miss':'')+'" style="height:'+(b.avg!=null?h:0)+'%" title="'+esc(title)+'" aria-label="'+esc(title)+'"></div>';
  }).join('');
  var startLabel=$('hourly-start');
  if(startLabel) startLabel.textContent=new Date(start).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric'});
  var summary=$('hourly-summary');
  if(!summary) return;
  if(!values.length){summary.textContent='No hourly samples yet. The next checks will populate this.';return;}
  var overall=Math.round(values.reduce(function(a,b){return a+b;},0)/values.length);
  summary.textContent='Average '+overall+' ms · peak '+peak.avg+' ms at '+new Date(peak.hour).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+' · '+samples+' samples';
}

function bindHourlyFilter(){
  var seg=document.querySelector('.hourly-seg');
  if(!seg) return;
  seg.addEventListener('click',function(e){
    var b=e.target.closest('button[data-h]');
    if(!b) return;
    var value=Number(b.getAttribute('data-h'));
    if(!value||value===state.hourFilter) return;
    state.hourFilter=value;
    renderHourly();
    var buttons=seg.querySelectorAll('button[data-h]');
    for(var i=0;i<buttons.length;i++){
      buttons[i].setAttribute('aria-selected',String(Number(buttons[i].getAttribute('data-h'))===value));
    }
  });
}

function renderError(){
  $('app').innerHTML='<div class="card"><p class="muted" style="margin:0 0 12px">We could not load the history data. The status page itself is unaffected.</p><button class="pill" type="button" id="retry">Try again</button></div>';
  var b=$('retry');
  if(b) b.addEventListener('click',function(){location.reload();});
}

function load(){
  var summary=fetchJSON(RAW+'history/summary.json').catch(function(){return null;});
  var slugs=SERVICE?[SERVICE]:SITES.map(function(s){return s.slug;});
  var histories=Promise.all(slugs.map(function(slug){
    return fetchText(RAW+'history/'+slug+'.yml').then(parseYml).then(function(h){return [slug,h];}).catch(function(){return [slug,null];});
  }));
  var hourly=SERVICE?fetchJSON(RAW+'history/hourly.json').catch(function(){return null;}):Promise.resolve(null);
  Promise.all([summary,histories,hourly]).then(function(res){
    state.summary=res[0];
    state.histories={};
    res[1].forEach(function(pair){state.histories[pair[0]]=pair[1];});
    state.hourly=res[2];
    var any=res[0]||res[1].some(function(p){return p[1];});
    if(!any){state.error=true;renderError();return;}
    if(SERVICE) renderService(); else renderIndex();
  }).catch(function(){state.error=true;renderError();});
}

var theme=$('theme');
if(theme) theme.addEventListener('click',function(){
  var root=document.documentElement;
  var next=root.getAttribute('data-theme')==='dark'?'light':'dark';
  root.setAttribute('data-theme',next);
  var meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content',next==='dark'?'#17141B':'#FBF8F3');
});

if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});}).catch(function(){});
}
if('caches' in window){
  caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k);});}).catch(function(){});
}

load();
})();
