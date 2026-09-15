// Public prices only: no Binance credentials or trading permissions.
export function conversion(prices,now=Date.now()) {
 const fresh=(key,age)=>prices[key]?.price>0&&now-prices[key].at<=age;
 const usd=fresh('USDTUSD',120000)?prices.USDTUSD.price:null;
 const brl=fresh('USDTBRL',45000)?prices.USDTBRL.price:null;
 const eth=fresh('ETHUSDT',45000)?prices.ETHUSDT.price:null;
 return {usdBRL:usd&&brl?brl/usd:null,ethUSD:usd&&eth?eth*usd:null,ethBRL:eth&&brl?eth*brl:null};
}
export function startMarket(onUpdate,{fetcher=fetch,Socket=WebSocket}={}) {
 const prices={};let socket,retry,timer,closed=false,busy=false,attempt=0;
 const emit=()=>onUpdate({prices:{...prices},...conversion(prices),connected:socket?.readyState===1});
 function accept(symbol,price,source){if(Number.isFinite(+price)&&+price>0){prices[symbol]={price:+price,at:Date.now(),source};emit();}}
 async function refresh(){if(busy||closed)return;busy=true;
  await Promise.allSettled([
   (async()=>{try{const r=await fetcher('https://data-api.binance.vision/api/v3/ticker/price?symbols=%5B%22ETHUSDT%22,%22USDTBRL%22%5D',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const data=await r.json();for(const x of data)if(['ETHUSDT','USDTBRL'].includes(x.symbol))accept(x.symbol,x.price,'Binance · consulta de 15 s');}catch{/* Last values remain visibly stale. */}})(),
   (async()=>{if(prices.USDTUSD&&Date.now()-prices.USDTUSD.at<55000)return;try{const r=await fetcher('https://api.coinbase.com/v2/prices/USDT-USD/spot',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const d=await r.json();if(d.data.currency==='USD')accept('USDTUSD',d.data.amount,'Coinbase · referência USDT/USD');}catch{}})()
  ]);busy=false;emit();
 }
 function connect(){if(closed)return;try{socket=new Socket('wss://data-stream.binance.vision/stream?streams=ethusdt@miniTicker/usdtbrl@miniTicker');socket.onopen=()=>{attempt=0;emit();};socket.onmessage=e=>{try{const d=JSON.parse(e.data).data;if(['ETHUSDT','USDTBRL'].includes(d?.s))accept(d.s,d.c,'Binance · streaming');}catch{}};socket.onerror=()=>socket.close();socket.onclose=()=>{emit();if(!closed)retry=setTimeout(connect,Math.min(30000,1000*2**attempt++));};}catch{if(!closed)retry=setTimeout(connect,15000);}}
 connect();refresh();timer=setInterval(()=>{refresh();emit();},15000);const freshness=setInterval(emit,1000);
 return {refresh,stop(){closed=true;clearInterval(timer);clearInterval(freshness);clearTimeout(retry);socket?.close();}};
}
