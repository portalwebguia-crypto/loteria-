# L7 PG — Portal de modalidades

Site em HTML, CSS e JavaScript, com carrinho de combinações, PIX direto por chave cadastrada no painel e integração opcional BlackCat em funções Node.js para Vercel.

- `index.html`: entrada do site.
- `home.html` e `compra-bolao/`: páginas de modalidades e combinações.
- `carrinho.html`: carrinho e checkout.
- `api/` e `lib/`: funções do servidor, pagamentos e persistência.
- `painel.html#pix`: cadastro protegido da chave, nome e cidade do titular. Requer ADMIN_PASSWORD (Secret, mínimo 16 caracteres) ou ADMIN_PASSWORD_HASH e Redis conectado ao projeto.
- `painel.html#pedidos`: pedidos do PIX direto e confirmação manual após conferir o crédito no extrato.

Para configurar credenciais, armazenamento Redis, identidade do recebedor e modo de pagamento, siga [PAYMENT-DEPLOYMENT.md](PAYMENT-DEPLOYMENT.md). As chaves privadas devem ficar nas variáveis do servidor. Subir os arquivos ao GitHub não ativa os pagamentos automaticamente.

O PIX direto ativado no painel tem prioridade e gera o QR localmente, sem chamar gateway. A confirmação do recebimento é manual; gerar o código não confirma pagamento. Chaves precisam estar registradas no banco e o cliente deve conferir o titular no aplicativo. A confirmação do PIX não registra apostas nem emite bilhetes: essa etapa depende da operação do vendedor e não está integrada neste projeto. Sem PIX direto ativo, o checkout mantém a integração BlackCat e suas validações; simulação só em desenvolvimento e preview.

## Bolões cadastrados e troca de hospedagem

Os bolões ficam em um hash Redis externo (`pools:catalog:v1`), sem prazo de expiração. Publicar o site ou trocar o servidor da hospedagem não apaga esse catálogo. A exclusão só acontece pela ação de excluir no painel administrativo, protegida por senha.

Ao trocar de hospedagem, configure no novo servidor as mesmas variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_URL` e `KV_REST_API_TOKEN`) apontando para o banco Redis que já contém os bolões. Não crie um banco novo se quiser manter os registros. Se também trocar o provedor ou o banco Redis, migre os dados antes; publicar os arquivos do site sozinho não transfere os dados do banco. Mantenha os backups e a retenção habilitados no provedor Redis.
## Verificação local

Com Node.js 22.13 ou superior:

```sh
npm ci
npm test
node tests/browser-smoke.cjs
```

Os testes usam dados fictícios e não movimentam dinheiro. Execute `npm start` para servir o site e as APIs em Node.js. A porta padrão é 3000; em produção, a variável `PORT` define a porta. No Railway, configure as variáveis necessárias descritas em [PAYMENT-DEPLOYMENT.md](PAYMENT-DEPLOYMENT.md) e gere um domínio público nas configurações do serviço.
