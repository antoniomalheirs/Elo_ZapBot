# 📲 ZapBot Alpha - Secretária Virtual WhatsApp

Sistema completo de atendimento automatizado via WhatsApp com agendamento, FAQ inteligente, transcrição de áudio e handoff para atendente humano.

---

## Quick Start

### Pré-requisitos
- Node.js 18+
- Docker Desktop
- npm

### 1. Iniciar Infraestrutura (Docker)
```bash
docker-compose up -d
```

### 2. Instalar Dependências
```bash
cd backend && npm install
cd ../admin && npm install
```

### 3. Configurar Ambiente
```bash
cp .env.example .env
# Editar .env com suas credenciais
```

### 4. Rodar Migrations do Prisma
```bash
cd backend
npx prisma generate
npx prisma db push
```

### 5. Iniciar Backend
```bash
npm run start:dev
```

### 6. Iniciar Admin Panel
```bash
cd admin
npm run dev
```

### 7. Escanear QR Code
Quando o servidor iniciar, um QR Code aparecerá no terminal.
Escaneie com o WhatsApp do celular que será usado como bot.

---

## 📁 Estrutura do Projeto

```
ZapBotAlpha/
├── docker-compose.yml      # PostgreSQL
├── backend/                # NestJS Backend (Port 3000)
│   ├── src/
│   │   ├── whatsapp/       # Conexão WhatsApp (Baileys)
│   │   ├── orchestrator/   # Cérebro do sistema
│   │   ├── ai/             # Integração Groq + Whisper
│   │   ├── context/        # Memória da conversa
│   │   ├── scheduling/     # Agendamentos
│   │   ├── scheduler/      # Cron Jobs (Lembretes)
│   │   ├── config/         # Configurações
│   │   └── database/       # Prisma
│   ├── prisma/
│   │   └── schema.prisma   # Schema do banco
│   └── .baileys_auth/      # Sessão WhatsApp (não versionar)
└── admin/                  # Next.js Admin Panel (Port 3001)
    └── src/app/
        ├── appointments/   # Lista de agendamentos
        ├── calendar/       # Calendário visual
        ├── conversations/  # Histórico de conversas
        ├── settings/       # Configurações
        ├── whatsapp/       # Status conexão
        └── simulator/      # Testar sem WhatsApp
```

---

## 🧠 Como Funciona

```
1. Mensagem chega via WhatsApp (Baileys)
2. Debounce de 2s (agrupa mensagens rápidas)
3. Verificar se é Admin → Comandos especiais
4. Verificar estado HUMAN_HANDOFF → Silenciar bot
5. Motor de Regras verifica palavras-chave
6. Se não encontrar → IA (Groq) processa
7. Orquestrador decide resposta e transição
8. Humanize Service adiciona variações naturais
9. Resposta enviada e salva no banco
```

---

## 📊 Estados da Conversa

| Estado | Descrição |
|--------|-----------|
| `INIT` | Primeiro contato |
| `AUTO_ATTENDANCE` | Atendimento automático |
| `FAQ_FLOW` | Respondendo perguntas |
| `SCHEDULING_FLOW` | Agendando horário |
| `CONFIRMATION_PENDING` | Aguardando confirmação |
| `HUMAN_HANDOFF` | Transferido para humano (bot silenciado) |
| `PAUSED` | Pausado |
| `COMPLETED` | Conversa finalizada |

---

## 🛠️ Módulos do Sistema

### WhatsApp Service (`whatsapp/`)
- Conexão via **Baileys** (WebSocket direto)
- Sessão persistida em `.baileys_auth/`
- QR Code no terminal
- **Debounce de 2 segundos** para evitar duplicatas
- Transcrição de áudio com Whisper

### Orchestrator (`orchestrator/`)
- `orchestrator.service.ts` - Lógica principal
- `rule-engine.ts` - Detecção de intenções por keywords
- `state-machine.ts` - Transições de estado
- `humanize.service.ts` - Respostas naturais

### AI Service (`ai/`)
- Integração com **Groq** (llama3) como fallback
- Análise de intenção com score de confiança
- Transcrição de áudio (Whisper)

### Scheduling (`scheduling/`)
- Criação/cancelamento de agendamentos
- Verificação de disponibilidade
- Lista de espera
- Bloqueio de horários

### Scheduler (`scheduler/`)
- Lembretes 24h antes
- Confirmação no dia
- Re-engajamento de conversas abandonadas

---

## 👑 Comandos do Admin (via WhatsApp)

**Requisito:** Configurar número do admin no painel

| Comando | Descrição |
|---------|-----------|
| `agenda` | Pacientes de hoje |
| `agenda amanhã` | Pacientes de amanhã |
| `agenda semana` | Próximos 7 dias |
| `agenda mês` | Resto do mês |
| `agenda 15/01` | Data específica |
| `encerrar` | Finaliza atendimento humano |
| `finalizar` | Finaliza atendimento humano |

---

## 🤝 Fluxo de Handoff Humano

1. Cliente: **"Falar com atendente"**
2. Bot notifica admin com dados do cliente
3. Estado muda para `HUMAN_HANDOFF`
4. **Bot para de responder** (mensagens são salvas)
5. Admin conversa diretamente pelo WhatsApp
6. Admin envia **"encerrar"**
7. Cliente recebe: "Seu atendimento foi finalizado!"
8. Bot volta a funcionar

---

## ⚙️ Configurações (Painel Admin)

Acesse `http://localhost:3001/settings`:

- **Identidade:** Nome da clínica
- **Localização:** Endereço, cidade
- **Notificações:** Celular do admin
- **Horários:** Abertura, fechamento, dias da semana
- **Slots:** Horários disponíveis para agendamento
- **Serviços:** Nome, preço, duração
- **FAQs:** Perguntas frequentes customizadas
- **Bloqueios:** Horários bloqueados (almoço, feriados)
- **Zona de Perigo:** Reset completo do banco

---

## 📦 Banco de Dados (PostgreSQL)

### Modelos Principais

| Modelo | Descrição |
|--------|-----------|
| **User** | Clientes (phone, name) |
| **Conversation** | Sessões de chat |
| **Message** | Mensagens (INBOUND/OUTBOUND) |
| **Appointment** | Agendamentos |
| **Waitlist** | Lista de espera |
| **BlockedSlot** | Horários bloqueados |
| **SystemConfig** | Configurações dinâmicas |

---

## 🔧 Scripts Úteis

```bash
# Backend
cd backend
npm run start:dev          # Dev mode com hot-reload
npx prisma studio          # UI visual do banco
npx prisma db push         # Sync schema
npx prisma db push --force-reset  # Reset banco

# Admin
cd admin
npm run dev                # Dev mode
npm run build              # Build produção
```

---

## 🐛 Troubleshooting

### WhatsApp não conecta
```bash
# Delete sessão e reinicie
rm -rf backend/.baileys_auth
cd backend && npm run start:dev
# Escaneie o novo QR Code
```

### Admin commands não funcionam
- Verifique número do admin no painel
- Use o número que aparece nos logs (formato pode ser `@lid`)

### Bot não responde
- Verifique se conversa está em `HUMAN_HANDOFF`
- Verifique logs: `[OrchestratorService]`

### Mensagens duplicadas
- Debounce de 2s deve evitar isso
- Reinicie backend para aplicar mudanças

---

## 📝 Variáveis de Ambiente

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/zapbot_db
GROQ_API_KEY=gsk_xxx
PORT=3000
```

---

## 🚀 Deploy

*(Em desenvolvimento)*

---

**Última atualização:** 14/01/2026
# Elo_ZapBot
