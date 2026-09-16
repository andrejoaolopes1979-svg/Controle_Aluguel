# Controle de Aluguel

App para celular (SPA + PWA) em HTML/CSS/JS para controle de aluguéis. Funciona 100% offline, sem servidor, com autenticação e dados salvos em armazenamento local do dispositivo (`localStorage` + backup durável em `IndexedDB`).

## Funcionalidades

- **Cadastro de pagamentos**: tipo do imóvel, unidade consumidora, valor recebido, data, tipo de pagamento e banco
- **Gráfico de pizza** no topo com o percentual recebido total de cada imóvel
- **Lista de pagamentos** na parte inferior com busca e filtros
- **Backup de dados**: exporte os dados para um arquivo JSON e restaure quando quiser; backup automático silencioso em `IndexedDB` (conciliado na inicialização) e botão "Salvar agora"
- **Autocomplete** que lembra imóveis, unidades e bancos já digitados
- **PWA**: instala no celular e funciona offline

## Como rodar

Abra direto no navegador (duplo clique no `index.html`) ou, para testar PWA/Service Worker:

```bash
npx serve .
```

Ou hospede em qualquer serviço estático (GitHub Pages, Netlify, etc.).

## Estrutura

```
index.html             SPA (app principal)
styles.css             Estilos mobile-first
app.js                 Lógica: CRUD local, gráfico, lista, autocomplete, backup
manifest.json          Configuração PWA
sw.js                  Service worker (cache offline)
icons/                 Ícones do app
```

## Observações

- Os dados ficam em dois lugares do navegador: `localStorage` (principal, chaves `aluguel_payments`, `aluguel_history`, `aluguel_saved_at`) e um espelho durável em `IndexedDB` (banco `controle-aluguel-db`, store `profile`, registro `main`).
- A cada gravação os dados são espelhados em `IndexedDB` silenciosamente (fila de Promises para evitar escritas concorrentes). Na inicialização, as duas fontes são reconciliadas pelo timestamp `savedAt` e a mais recente vence, sincronizando a outra — assim, limpar o cache do navegador (ou os dados de sites) não perde nada, pois a fonte restante restaura tudo.
- Se o `IndexedDB` estiver indisponível (modo anônimo/privado, quota), o app segue funcionando só com `localStorage` e o indicador mostra "Backup automático indisponível".
- Use o botão **Salvar agora** na seção "Backup de dados" para forçar a sincronização manual das duas fontes, com confirmação via toast.
- Para transferir dados entre dispositivos ou manter um backup externo, use **Exportar JSON** na seção "Backup de dados" e depois **Importar JSON** no outro aparelho.
- Os campos de imóvel/unidade/banco são lembrados em `localStorage` para facilitar a digitação.

## Testes

A lógica de conciliação de backup é testada com o runner nativo do Node:

```bash
node --test test/
```