# 🚀 Guia de Deploy no Railway

Este guia explica como fazer deploy do ZapBot no Railway.

---

## 📋 Pré-requisitos

1. Conta no [Railway](https://railway.app) (pode usar GitHub para login)
2. Repositório Git (GitHub, GitLab, etc.)
3. Chave da API Gemini (Google AI Studio)

---

## 🛠️ Passo a Passo

### 1. Preparar o Repositório

Certifique-se de que seu código está commitado no Git:

```bash
cd c:\Users\Zeca\Desktop\ZapBotAlpha
git add .
git commit -m "Preparando para deploy Railway"
git push
```

### 2. Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Autorize o acesso ao seu repositório
5. Selecione o repositório **ZapBotAlpha**

### 3. Configurar Serviço do Backend

1. Após importar, clique no serviço criado
2. Vá em **Settings → Build**
3. Defina o **Root Directory** como: `backend`
4. O Railway vai detectar o `Dockerfile` automaticamente

### 4. Adicionar PostgreSQL

1. No projeto, clique em **"+ New"**
2. Selecione **"Database" → "PostgreSQL"**
3. Railway vai criar o banco e vincular automaticamente
4. A variável `DATABASE_URL` será injetada automaticamente!

### 5. Configurar Variáveis de Ambiente

Vá em **Variables** no serviço backend e adicione:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `NODE_ENV` | `production` | Ambiente de produção |
| `PORT` | `3000` | Porta do servidor |
| `GEMINI_API_KEY` | `sua-chave` | Chave da API Gemini |
| `SESSION_PATH` | `/app/.baileys_auth` | Caminho da sessão WhatsApp |

> **Nota**: `DATABASE_URL` é adicionada automaticamente pelo Railway quando você conecta o PostgreSQL.

### 6. Adicionar Volume Persistente (Importante!)

Para manter a sessão do WhatsApp entre deploys:

1. No serviço backend, vá em **Settings → Storage**
2. Clique em **"Add Volume"**
3. Configure:
   - **Mount Path**: `/app/.baileys_auth`
   - **Size**: 1 GB é suficiente

### 7. Deploy

1. Clique em **"Deploy"** ou faça um push no GitHub
2. Acompanhe os logs de build
3. Quando terminar, acesse a URL fornecida pelo Railway

### 8. Escanear QR Code

1. Acesse os logs do serviço no Railway
2. O QR Code do WhatsApp aparecerá nos logs
3. Escaneie com seu celular para conectar
4. A sessão será salva no volume persistente

---

## 🔧 Variáveis de Ambiente Completas

```env
# Obrigatórias
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://... (automático pelo Railway)
GEMINI_API_KEY=sua-chave-aqui
SESSION_PATH=/app/.baileys_auth

# Opcionais (se usar Redis)
REDIS_URL=redis://... (automático se adicionar Redis)
```

---

## ⚠️ Dicas Importantes

### Sobre a Sessão WhatsApp

- O volume persistente mantém sua sessão entre deploys
- Se precisar reconectar, delete o conteúdo do volume
- Não faça logout do WhatsApp no celular!

### Sobre o Plano

- O plano **Hobby** ($5/mês) é suficiente para começar
- Cada serviço (backend + postgres) usa recursos separados
- Monitore o uso na dashboard

### Logs e Debugging

- Use a aba **Logs** no Railway para ver saída do servidor
- Erros de conexão WhatsApp aparecerão nos logs
- O healthcheck verifica `/health` a cada 30s

---

## 🆘 Troubleshooting

### "Cannot find module..."
- Verifique se o build completou corretamente
- Cheque se o `prisma generate` rodou

### "Database connection failed"
- Verifique se o PostgreSQL está vinculado
- A variável `DATABASE_URL` deve existir

### "WhatsApp disconnected"
- Verifique os logs para erros de sessão
- Pode ser necessário escanear o QR novamente
- Confirme que o volume está montado corretamente

### "Build failed"
- Verifique os logs de build
- Confirme que o Root Directory é `backend`

---

## 📌 URLs Úteis

- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Docs](https://docs.railway.app)
- [Prisma Deploy Guide](https://www.prisma.io/docs/guides/deployment)
