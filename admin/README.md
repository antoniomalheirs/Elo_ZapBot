# 🤖 Elo_ZapBot Admin Panel

O **Elo_ZapBot Admin** é a central de comando para a Secretária Virtual Inteligente com IA. Construído com **Next.js 14**, **TailwindCSS** e **shadcn/ui**, ele oferece uma interface moderna e responsiva para monitorar, configurar e analisar o desempenho do bot em tempo real.

## 🚀 Funcionalidades Principais

### 📊 1. Mission Control (Dashboard)
Visão geral completa da operação em tempo real:
- **KPIs em Tempo Real**: Consultas do dia, fila de mensagens, total mensal e handoffs.
- **Gráficos de Performance**: Volume de agendamentos e mensagens (Semanal).
- **Monitoramento de Status**: Conexão do WhatsApp (Online/Offline) e status da bateria.
- **Atividade Recente**: Feed ao vivo das últimas interações do bot.
- **Próximos Agendamentos**: Lista rápida das próximas consultas confirmadas.

### 📈 2. Estatísticas Avançadas (`/stats`)
Análise profunda de dados para inteligência de negócio:
- **Filtros de Período**: Visualização por Semana, Mês ou Ano.
- **Mapa de Calor (Heatmap)**: Identificação visual de picos de atendimento por dia e hora.
- **Métricas de Conversão**: % de visitantes que se tornam pacientes agendados.
- **Retenção de Clientes**: Rastreamento de pacientes recorrentes vs. novos.
- **Tempo de Resposta**: Monitoramento da latência média do bot.
- **Top Intenções**: Gráficos das principais razões de contato dos usuários.

### 📅 3. Gestão de Agenda (`/calendar`)
Controle total sobre os agendamentos:
- **Visualização de Calendário**: Interface intuitiva (mês/semana/dia).
- **Detalhes da Consulta**: Visualização rápida de paciente, serviço e status.
- **Bloqueio de Horários**: Funcionalidade para bloquear slots manualmente.

### 💬 4. Monitoramento de Conversas (`/conversations`)
Acompanhamento e intervenção em chats:
- **Histórico de Mensagens**: Visualização completa da troca de mensagens.
- **Status da Conversa**: Identificação de estados (IA, Agendamento, Handoff).
- **Intervenção Humana**: Capacidade de assumir a conversa quando necessário.

### ⚙️ 5. Configurações do Sistema (`/settings`)
Personalização total do comportamento do bot:
- **Horário de Funcionamento**: Definição flexível de dias e horários de atendimento.
- **Serviços**: Cadastro de serviços com duração e preço.
- **Prompt da IA**: Ajuste da personalidade e instruções da IA (Groq).
- **Parâmetros**: Configuração de telefone do admin e chaves de API.
- **Reset**: Ferramentas de manutenção de banco de dados e sessão.

### 🎮 6. Simulador de Testes (`/simulator`)
Ambiente seguro para testar fluxos e respostas:
- **Sandbox**: Teste respostas da IA sem afetar usuários reais.
- **Debug de Fluxo**: Verifique se a máquina de estados está respondendo corretamente.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: Next.js 14 (App Router)
- **Estilização**: TailwindCSS + Lucide Icons
- **Gráficos**: Recharts
- **Estado/Data Fetching**: React Hooks + Fetch API
- **Ícones**: Lucide React

## 📦 Instalação e Execução

O painel roda em conjunto com o backend NestJS.

```bash
# Instalar dependências
npm install

# Rodar em modo de desenvolvimento
npm run dev
# Acessar em http://localhost:3001
```

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz da pasta `admin` (se necessário, embora a maioria das configs venha do backend):

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```
