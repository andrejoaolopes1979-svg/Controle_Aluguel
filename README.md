# Controle de Aluguel

App para celular (SPA + PWA) em HTML/CSS/JS para controle de aluguéis. Funciona 100% offline, sem servidor, com autenticação e dados salvos no armazenamento local do dispositivo (`localStorage`).

## Funcionalidades

- **Cadastro de pagamentos**: tipo do imóvel, unidade consumidora, valor recebido, data, tipo de pagamento e banco
- **Gráfico de pizza** no topo com o percentual recebido total de cada imóvel
- **Lista de pagamentos** na parte inferior com busca e filtros
- **Backup de dados**: exporte os dados para um arquivo JSON e restaure quando quiser
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

- Os dados ficam no `localStorage` (chave `aluguel_payments`) e são salvos apenas neste dispositivo.
- Para transferir dados entre dispositivos ou manter um backup seguro, use **Exportar JSON** na seção "Backup de dados" e depois **Importar JSON** no outro aparelho.
- Os campos de imóvel/unidade/banco são lembrados em `localStorage` para facilitar a digitação.