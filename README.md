# ETH Ledger

Controle pessoal de operações Spot em Ethereum, em português, feito com HTML, CSS e JavaScript puro. Hospedável no GitHub Pages, sem build ou dependências de produção.

## Recursos

- Compras independentes e vendas parciais vinculadas ao lote escolhido.
- Taxas reais em USD, ETH ou BNB, com cotação histórica do BNB.
- Lucro líquido total, diário, semanal, mensal e anual em horário de Brasília.
- Posições abertas, custo médio, capital alocado, resultado não realizado e gráfico acumulado.
- Histórico, pesquisa, CSV e backup/restauração JSON sem sobrescrever registros.
- Google Sheets via Apps Script com chave privada, validação no servidor, bloqueio de concorrência e IDs idempotentes.
- Salvamento local imediato; confirmação de sincronização somente após resposta válida do Google.

## Executar

Com Node.js 20 ou superior: `npm start`. Abra http://127.0.0.1:4173. Testes: `npm test`.

## Google Sheets

Planilha: https://docs.google.com/spreadsheets/d/1HR5RFwTZWUOUqz3QVMRM1UQ9XBHl7pVPHXCLLAdxrgk/edit

1. Na planilha, abra **Extensões → Apps Script**.
2. Cole `apps-script/Code.gs` no editor. O projeto é vinculado a essa planilha.
3. Execute `setup` para criar `ETH_Operacoes` e `ETH_Resumo`, preservando outras abas.
4. Autorize o script. Ele usa `@OnlyCurrentDoc` para limitar o acesso ao documento vinculado.
5. Nas configurações do projeto, copie a propriedade `ACCESS_TOKEN` gerada. Não publique a chave no repositório.
6. Implante como aplicativo da Web, executando como proprietário, com acesso “Qualquer pessoa”. O endpoint rejeita requisições sem a chave correta.
7. No aplicativo, abra **Conexão e ajustes**, informe a URL `/exec` e a chave e conecte.

A chave é salva somente no armazenamento do navegador. Para outro navegador/dispositivo, informe novamente a configuração. Os trades são incorporados por ID. Uma falha de rede mantém os registros locais pendentes; repetir sincronização não duplica operações. A planilha publicamente compartilhada permite leitura pública, independentemente da chave do endpoint. As abas gerenciadas devem ser alimentadas pelo app; conflitos em registros existentes bloqueiam a sincronização.

O resumo da planilha é recalculado a cada sincronização; o painel calcula os períodos ao renderizar. Exporte backups regularmente. Não limpe dados do navegador antes de confirmar a sincronização.

## Cálculo

Compra com taxa em USD/BNB: custo = quantidade × preço + taxa em USD. Compra com taxa em ETH: quantidade disponível = quantidade executada − taxa; custo = valor bruto, evitando contar a taxa duas vezes.

Venda: lucro = receita líquida − custo proporcional da quantidade consumida do lote. Taxa de venda em ETH consome saldo adicional. Valorização em aberto usa a cotação de referência e não inclui uma futura taxa de saída. O sistema registra execuções já feitas; não envia ordens à Binance.

Padrão Binance Spot regular: 0,10% por execução; com desconto BNB, 0,075%. Pode variar por par, promoção e nível VIP. Confira seu extrato. Fonte consultada em 15/09/2026: https://www.binance.com/en/fee/trading

Valores do registro são USD. Se o extrato estiver em USDT, informe o equivalente em USD; não há conversão implícita. Cotação opcional: Coinbase ETH/USD, com fallback manual.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha **Deploy from a branch**, branch **main**, pasta **/(root)**. O `.nojekyll` permite servir os arquivos estáticos diretamente. Nunca inclua tokens ou backups financeiros nos commits.
