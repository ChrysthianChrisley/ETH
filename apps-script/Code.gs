/** @OnlyCurrentDoc */
function validate(t){
 if(!t||!['buy','sell'].includes(t.type)||typeof t.id!=='string'||!t.id||!Number.isFinite(Date.parse(t.date)))throw Error('Operação inválida.');
 if(!Number.isFinite(t.qty)||t.qty<=0||!Number.isFinite(t.price)||t.price<=0)throw Error('Quantidade e preço devem ser positivos.');
 if(!Number.isFinite(t.fee)||t.fee<0||!['USD','USDT','ETH','BNB'].includes(t.feeAsset))throw Error('Taxa inválida.');
 if(t.type==='buy'&&t.feeAsset==='ETH'&&t.fee>=t.qty)throw Error('Taxa em ETH excede a compra.');
 if(t.type==='sell'&&!t.lotId)throw Error('Selecione a compra de origem.');
 if(t.feeAsset==='BNB'&&(!Number.isFinite(t.bnbPrice)||t.bnbPrice<=0))throw Error('Informe a cotação do BNB em USD.');
}
function calculate(trades,quote=0){
 const lots=[],sales=[],ids=new Set();let fees=0;
 for(const t of [...trades].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||(a.type===b.type?0:a.type==='buy'?-1:1))){validate(t);if(ids.has(t.id))throw Error('ID duplicado.');ids.add(t.id);
 const feeUSD=t.fee*(t.feeAsset==='ETH'?t.price:t.feeAsset==='BNB'?t.bnbPrice:1);fees+=feeUSD;
 if(t.type==='buy'){const qty=t.qty-(t.feeAsset==='ETH'?t.fee:0);const cost=t.qty*t.price+(t.feeAsset==='ETH'?0:feeUSD);lots.push({...t,netQty:qty,remaining:qty,cost,unitCost:cost/qty,realized:0});}
 else {const lot=lots.find(l=>l.id===t.lotId);const consumed=t.qty+(t.feeAsset==='ETH'?t.fee:0);if(!lot||consumed>lot.remaining+1e-10)throw Error('Venda excede o saldo disponível da compra ou é anterior a ela.');const proceeds=t.qty*t.price-(t.feeAsset==='ETH'?0:feeUSD);const basis=consumed*lot.unitCost;const profit=proceeds-basis;lot.remaining=Math.max(0,lot.remaining-consumed);lot.realized+=profit;sales.push({...t,profit,basis,feeUSD});}
 }
 const qty=lots.reduce((s,l)=>s+l.remaining,0),cost=lots.reduce((s,l)=>s+l.remaining*l.unitCost,0);return {lots,sales,qty,cost,fees,average:qty?cost/qty:0,realized:sales.reduce((s,t)=>s+t.profit,0),unrealized:quote>0?qty*quote-cost:null};
}
function dayKey(date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));}
function inferredFee(bought,sold){if(!(bought>0)||!(sold>=0)||sold>bought)throw Error('Informe quantidades válidas.');return {amount:bought-sold,rate:(bought-sold)/bought*100};}
function allocateSale(trades,sale){
 if(sale.lotId!=='AUTO')return [sale];
 const lots=calculate(trades).lots.filter(l=>l.remaining>1e-12&&Date.parse(l.date)<=Date.parse(sale.date));
 const consumed=sale.qty+(sale.feeAsset==='ETH'?sale.fee:0);
 if(consumed>lots.reduce((s,l)=>s+l.remaining,0)+1e-10)throw Error('Saldo insuficiente para a venda e sua taxa.');
 let left=consumed,qtyLeft=sale.qty,feeLeft=sale.fee;const result=[];
 for(const lot of lots){if(left<1e-12)break;const amount=Math.min(left,lot.remaining),last=left-amount<1e-12;
 const qty=last?qtyLeft:sale.qty*amount/consumed,fee=last?feeLeft:sale.fee*amount/consumed;
 result.push({...sale,id:sale.id+'-'+(result.length+1),qty,fee,lotId:lot.id,note:(sale.note+' | Venda agrupada '+sale.id.slice(0,8)).slice(0,250)});left-=amount;qtyLeft-=qty;feeLeft-=fee;
 }return result;
}
function periods(sales,now=new Date()){
 const today=dayKey(now),d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const week=d.toISOString().slice(0,10);
 const r={total:0,day:0,week:0,month:0,year:0};for(const s of sales){const key=dayKey(s.date);if(key>today)continue;r.total+=s.profit;if(key===today)r.day+=s.profit;if(key>=week)r.week+=s.profit;if(key.slice(0,7)===today.slice(0,7))r.month+=s.profit;if(key.slice(0,4)===today.slice(0,4))r.year+=s.profit;}return r;
}

const HEADERS=['ID','Tipo','Data UTC','Quantidade ETH','Preço USDT','Taxa','Moeda taxa','BNB USDT','Compra origem','Nota','Lucro realizado USDT'];
function setup(){
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('ACCESS_TOKEN'))props.setProperty('ACCESS_TOKEN',Utilities.getUuid()+Utilities.getUuid());
 const ss=SpreadsheetApp.getActiveSpreadsheet();
 const s=ss.getSheetByName('ETH_Operacoes')||ss.insertSheet('ETH_Operacoes');
 if(s.getLastRow()===0){s.appendRow(HEADERS);s.setFrozenRows(1);s.getRange(1,1,1,HEADERS.length).setFontWeight('bold').setBackground('#eef1ed');s.setColumnWidths(1,11,145);s.setColumnWidth(3,200);s.setColumnWidth(10,230);s.getRange('D2:H1000').setNumberFormat('0.00000000');s.getRange('K2:K1000').setNumberFormat('0.00000000');s.getRange(1,1,1000,11).createFilter();}
 s.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);s.getRange('K2:K1000').setNumberFormat('0.00000000');s.getRange('J2:J1000').setWrap(true);s.setColumnWidth(10,340);
 const summary=ss.getSheetByName('ETH_Resumo')||ss.insertSheet('ETH_Resumo');
 if(summary.getLastRow()===0){summary.getRange(1,1,10,2).setValues([['ETH LEDGER · RESUMO','USDT'],['Lucro total',0],['Lucro diário',0],['Lucro semanal',0],['Lucro mensal',0],['Lucro anual',0],['Saldo ETH',0],['Capital aberto USDT',0],['Taxas pagas USDT',0],['Atualizado em','']]);summary.setColumnWidth(1,240);summary.setColumnWidth(2,240);summary.getRange('A1:B1').setFontWeight('bold').setBackground('#eef1ed');summary.getRange('B2:B9').setNumberFormat('0.00');summary.getRange('B7').setNumberFormat('0.00000000');summary.setFrozenRows(1);}
 summary.getRange(1,1,1,2).setValues([['ETH LEDGER · RESUMO','USDT (base)']]);
 summary.getRange(8,1,2,1).setValues([['Capital aberto USDT'],['Taxas pagas USDT']]);
 refreshSummary(readTrades());
}
function readTrades(){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ETH_Operacoes');if(!s)throw Error('Execute setup primeiro.');if(s.getRange(1,1,1,11).getValues()[0].join('|')!==HEADERS.join('|'))throw Error('Cabeçalhos alterados. Restaure o esquema original.');if(s.getLastRow()<2)return [];return s.getRange(2,1,s.getLastRow()-1,11).getValues().filter(r=>r[0]).map(r=>({id:String(r[0]),type:r[1],date:r[2] instanceof Date?r[2].toISOString():r[2],qty:Number(r[3]),price:Number(r[4]),fee:Number(r[5]),feeAsset:r[6],bnbPrice:Number(r[7]),lotId:String(r[8]),note:String(r[9])}));}
function refreshSummary(trades){const r=calculate(trades),p=periods(r.sales);const ss=SpreadsheetApp.getActiveSpreadsheet();const operations=ss.getSheetByName('ETH_Operacoes');if(operations.getLastRow()>1){const profits=new Map(r.sales.map(t=>[t.id,t.profit]));const ids=operations.getRange(2,1,operations.getLastRow()-1,1).getValues();operations.getRange(2,11,ids.length,1).setValues(ids.map(row=>[profits.has(String(row[0]))?profits.get(String(row[0])):'']));}const provisional=trades.some(t=>/\[REVISAR\]|\[TAXA ESTIMADA\]/.test(t.note));ss.getSheetByName('ETH_Resumo').getRange(1,1).setValues([[provisional?'ETH LEDGER · ESTIMATIVA A CONFERIR':'ETH LEDGER · RESUMO']]);SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ETH_Resumo').getRange(2,2,9,1).setValues([[p.total],[p.day],[p.week],[p.month],[p.year],[r.qty],[r.cost],[r.fees],[new Date().toISOString()]]);}
function doPost(e){const lock=LockService.getScriptLock();try{const data=JSON.parse(e.postData.contents);const key=PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');if(!key||data.token!==key)throw Error('Chave de acesso inválida.');if(!['read','append'].includes(data.action))throw Error('Ação inválida.');lock.waitLock(25000);let trades=readTrades();
 if(data.action==='append'){if(!Array.isArray(data.trades)||data.trades.length>1000)throw Error('Lote de sincronização inválido.');const map=new Map(trades.map(t=>[t.id,t])),fresh=[];for(const input of data.trades){validate(input);if(input.feeAsset==='USD')throw Error('Versão antiga: atualize o site. A moeda de cálculo agora é USDT.');if(Date.parse(input.date)>Date.now()+60000)throw Error('Data futura não permitida.');const t={id:input.id,type:input.type,date:input.date,qty:input.qty,price:input.price,fee:input.fee,feeAsset:input.feeAsset,bnbPrice:input.bnbPrice,lotId:input.lotId||'',note:input.note||''};if(typeof t.note!=='string'||t.note.length>250)throw Error('Nota inválida.');if(map.has(t.id)){if(JSON.stringify(map.get(t.id))!==JSON.stringify(t))throw Error('ID existente com dados diferentes.');continue;}map.set(t.id,t);fresh.push(t);}const merged=[...map.values()],result=calculate(merged);const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ETH_Operacoes');if(fresh.length){const safe=v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v;const rows=fresh.map(t=>[t.id,t.type,t.date,t.qty,t.price,t.fee,t.feeAsset,t.bnbPrice,t.lotId,t.note,result.sales.find(x=>x.id===t.id)?.profit??''].map(safe));const end=s.getLastRow()+fresh.length;if(end>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),end-s.getMaxRows());s.getRange(s.getLastRow()+1,1,rows.length,11).setValues(rows);}
 trades=merged;}
 refreshSummary(trades);SpreadsheetApp.flush();return ContentService.createTextOutput(JSON.stringify({ok:true,trades,baseCurrency:'USDT'})).setMimeType(ContentService.MimeType.JSON);
 }catch(err){return ContentService.createTextOutput(JSON.stringify({ok:false,error:err.message})).setMimeType(ContentService.MimeType.JSON);}finally{if(lock.hasLock())lock.releaseLock();}}
