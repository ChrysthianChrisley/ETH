export function validate(t){
 if(!t||!['buy','sell'].includes(t.type)||typeof t.id!=='string'||!t.id||!Number.isFinite(Date.parse(t.date)))throw Error('Operação inválida.');
 if(!Number.isFinite(t.qty)||t.qty<=0||!Number.isFinite(t.price)||t.price<=0)throw Error('Quantidade e preço devem ser positivos.');
 if(!Number.isFinite(t.fee)||t.fee<0||!['USD','ETH','BNB'].includes(t.feeAsset))throw Error('Taxa inválida.');
 if(t.type==='buy'&&t.feeAsset==='ETH'&&t.fee>=t.qty)throw Error('Taxa em ETH excede a compra.');
 if(t.type==='sell'&&!t.lotId)throw Error('Selecione a compra de origem.');
 if(t.feeAsset==='BNB'&&(!Number.isFinite(t.bnbPrice)||t.bnbPrice<=0))throw Error('Informe a cotação do BNB em USD.');
}
export function calculate(trades,quote=0){
 const lots=[],sales=[],ids=new Set();let fees=0;
 for(const t of [...trades].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||(a.type===b.type?0:a.type==='buy'?-1:1))){validate(t);if(ids.has(t.id))throw Error('ID duplicado.');ids.add(t.id);
 const feeUSD=t.fee*(t.feeAsset==='ETH'?t.price:t.feeAsset==='BNB'?t.bnbPrice:1);fees+=feeUSD;
 if(t.type==='buy'){const qty=t.qty-(t.feeAsset==='ETH'?t.fee:0);const cost=t.qty*t.price+(t.feeAsset==='ETH'?0:feeUSD);lots.push({...t,netQty:qty,remaining:qty,cost,unitCost:cost/qty,realized:0});}
 else {const lot=lots.find(l=>l.id===t.lotId);const consumed=t.qty+(t.feeAsset==='ETH'?t.fee:0);if(!lot||consumed>lot.remaining+1e-10)throw Error('Venda excede o saldo disponível da compra ou é anterior a ela.');const proceeds=t.qty*t.price-(t.feeAsset==='ETH'?0:feeUSD);const basis=consumed*lot.unitCost;const profit=proceeds-basis;lot.remaining=Math.max(0,lot.remaining-consumed);lot.realized+=profit;sales.push({...t,profit,basis,feeUSD});}
 }
 const qty=lots.reduce((s,l)=>s+l.remaining,0),cost=lots.reduce((s,l)=>s+l.remaining*l.unitCost,0);return {lots,sales,qty,cost,fees,average:qty?cost/qty:0,realized:sales.reduce((s,t)=>s+t.profit,0),unrealized:quote>0?qty*quote-cost:null};
}
export function dayKey(date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));}
export function periods(sales,now=new Date()){
 const today=dayKey(now),d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const week=d.toISOString().slice(0,10);
 const r={total:0,day:0,week:0,month:0,year:0};for(const s of sales){const key=dayKey(s.date);if(key>today)continue;r.total+=s.profit;if(key===today)r.day+=s.profit;if(key>=week)r.week+=s.profit;if(key.slice(0,7)===today.slice(0,7))r.month+=s.profit;if(key.slice(0,4)===today.slice(0,4))r.year+=s.profit;}return r;
}
