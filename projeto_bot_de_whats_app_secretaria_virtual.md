# 📲 Projeto: Bot de WhatsApp – Secretária Virtual Profissional

## 1. Visão Geral
Este projeto tem como objetivo desenvolver um **bot profissional de WhatsApp** que atue como uma **secretária virtual**, capaz de:
- Ler mensagens recebidas
- Interpretar intenções do usuário
- Responder automaticamente de forma contextual
- Organizar informações (agendamentos, dúvidas, contatos)
- Escalar para um humano quando necessário

O sistema deve ser **seguro, escalável, auditável e compatível com boas práticas de engenharia de software e LGPD**.

---

## 2. Casos de Uso Principais

### 2.1 Atendimento Automático
- Responder perguntas frequentes
- Informar horários de funcionamento
- Explicar serviços
- Direcionar o usuário corretamente

### 2.2 Agendamentos
- Criar, remarcar e cancelar horários
- Validar disponibilidade
- Confirmar agendamento automaticamente
- Enviar lembretes

### 2.3 Triagem Inteligente
- Identificar urgência
- Classificar tipo de solicitação
- Encaminhar para humano quando necessário

### 2.4 Atendimento Humanizado
- Linguagem natural
- Memória de contexto
- Personalização por nome

---

## 3. Arquitetura do Sistema (Visão Profissional)

### 3.1 Stack Tecnológica – Decisão Arquitetural

#### Backend Core
**NestJS (Node.js + TypeScript)** – escolhido por:
- Arquitetura opinada e modular
- Excelente suporte a Webhooks
- Escalabilidade natural
- Fácil integração com IA e filas
- Alto padrão profissional

> Alternativa válida: .NET 8 Web API (excelente para ambientes Microsoft), porém NestJS oferece maior ecossistema pronto para bots e integrações.

#### IA / NLP
- **OpenAI (GPT-4.x / GPT-4o)** para:
  - Classificação de intenção
  - Extração de entidades
  - Respostas naturais

- Estratégia híbrida:
  - Regras determinísticas + IA
  - IA nunca decide sozinha ações críticas

#### Banco de Dados
- **PostgreSQL** – dados persistentes
- **Redis** – sessões, contexto curto e rate limiting

#### WhatsApp API
- **WhatsApp Business Cloud API (Meta)**
  - Oficial
  - Estável
  - Escalável

#### Infraestrutura
- Docker
- CI/CD
- Cloud (AWS / Azure / Railway / Render)

---

### 3.2 Arquitetura Lógica (Camadas)

```
┌──────────────────────────────┐
│        WhatsApp API          │
└──────────────┬───────────────┘
               │ Webhook
┌──────────────▼───────────────┐
│        API Gateway           │
│  (Validação + Rate Limit)    │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│     Conversation Orchestrator│
│ (Cérebro do Sistema)         │
└───────┬───────────┬──────────┘
        │           │
┌───────▼──────┐ ┌──▼──────────┐
│ Rule Engine  │ │   IA / NLP   │
└───────┬──────┘ └──┬───────────┘
        │             │
┌───────▼─────────────▼─────────┐
│        Context Manager         │
│ (Memória + Estado da Conversa)│
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│        Banco de Dados         │
└──────────────────────────────┘
```

---


## 4. Integração com WhatsApp

### 4.1 Opções Oficiais (Recomendado)
- **WhatsApp Business Cloud API (Meta)**
- Provedores: Twilio, Z-API, 360dialog

⚠️ Evitar soluções não oficiais (risco de banimento)

### 4.2 Webhooks
- Endpoint HTTPS
- Validação de assinatura
- Rate limiting

---

## 5. Funcionamento Interno do Bot (Sem Código)

### 5.1 Fluxo Geral de Mensagens

1. Usuário envia mensagem no WhatsApp
2. WhatsApp chama Webhook
3. API valida requisição
4. Mensagem é normalizada
5. Contexto do usuário é carregado
6. Sistema decide:
   - Regra fixa?
   - IA necessária?
   - Escalar para humano?
7. Resposta é gerada
8. Mensagem enviada ao usuário
9. Logs e métricas são salvos

---

### 5.2 Orquestrador de Conversa (Peça Mais Importante)

Responsável por:
- Controlar estado da conversa
- Decidir próximos passos
- Evitar respostas erradas
- Evitar loops

Estados possíveis:
- Novo contato
- Em atendimento automático
- Em agendamento
- Aguardando confirmação
- Em atendimento humano

---

### 5.3 Motor de Regras vs IA

**Regra sempre vem antes da IA**

Exemplos de regras:
- Horário de funcionamento
- Palavras-chave críticas
- Cancelamentos
- Emergências

A IA entra quando:
- Linguagem ambígua
- Perguntas abertas
- Atendimento humanizado

---


## 6. Inteligência Artificial / NLP

### 6.1 Funções da IA
- Classificação de intenção
- Extração de entidades (datas, nomes, serviços)
- Geração de respostas naturais

### 6.2 Boas Práticas
- Prompt versionado
- Fallback para regras
- Limite de tokens
- Cache de respostas comuns

### 6.3 Modos de Resposta
- Regras fixas (FAQ)
- IA contextual
- Handoff humano

---

## 7. Gerenciamento de Contexto (Memória do Bot)

### 7.1 Tipos de Memória

#### Memória Curta (Sessão)
- Últimas mensagens
- Estado atual
- Timeout automático

#### Memória Longa (Resumo)
- Histórico resumido
- Preferências
- Último atendimento

Nunca salvar histórico completo em texto cru (LGPD).

---

### 7.2 Identidade Conversacional

Cada usuário possui:
- ID interno
- Telefone
- Nome
- Tipo de cliente
- Flags (VIP, recorrente, bloqueado)

---


## 8. Banco de Dados

### 8.1 Tecnologias
- PostgreSQL (recomendado)
- Redis (cache e sessões)

### 8.2 Principais Entidades
- Users
- Conversations
- Messages
- Appointments
- Intents
- Logs

---

## 9. Segurança e LGPD

### 9.1 Segurança
- HTTPS obrigatório
- Secrets via env
- Criptografia de dados sensíveis
- Autenticação no painel admin

### 9.2 LGPD
- Consentimento explícito
- Direito ao esquecimento
- Logs anonimizados
- Política de retenção

---

## 10. Logs, Monitoramento e Auditoria

### 10.1 Logs
- Mensagens recebidas/enviadas
- Decisões da IA
- Erros

### 10.2 Monitoramento
- Health checks
- Alertas
- Métricas de resposta

Ferramentas:
- Grafana
- Prometheus
- Sentry

---

## 11. Painel Administrativo

### 11.1 Funcionalidades
- Visualizar conversas
- Assumir atendimento manual
- Editar respostas
- Ver métricas
- Gerenciar horários

### 11.2 Tecnologias
- Next.js
- React
- Tailwind

---

## 12. Testes

### 12.1 Tipos de Testes
- Unitários
- Integração
- Testes de fluxo conversacional

### 12.2 Testes Críticos
- Loop de mensagens
- Falhas da IA
- Erros de webhook

---

## 13. Deploy e Infraestrutura

### 13.1 Infra
- Docker
- CI/CD
- Cloud (Vercel, AWS, Azure)

### 13.2 Ambientes
- Dev
- Staging
- Production

---

## 14. Escalabilidade

- Stateless backend
- Filas (RabbitMQ / SQS)
- Rate limiting por usuário
- Sharding de conversas

---

## 15. Governança do Projeto

### 15.1 Versionamento
- Git Flow

### 15.2 Documentação
- OpenAPI (Swagger)
- Diagramas

### 15.3 Manutenção
- Logs históricos
- Atualização de prompts
- Métricas de qualidade

---

## 16. Máquina de Estados da Conversa (Coração do Sistema)

### 16.1 Estados Globais

- INIT (primeiro contato)
- AUTO_ATTENDANCE (atendimento automático)
- FAQ_FLOW
- SCHEDULING_FLOW
- CONFIRMATION_PENDING
- HUMAN_HANDOFF
- PAUSED (fora do horário)
- BLOCKED (LGPD / opt-out)

Cada conversa **sempre está em exatamente um estado**.

---

### 16.2 Transições de Estado

Eventos que causam mudança:
- Mensagem do usuário
- Timeout
- Ação confirmada
- Erro de entendimento
- Regra crítica

Regras:
- IA **não muda estado diretamente**
- Apenas o Orquestrador pode transicionar

---

## 17. Fluxos Conversacionais Oficiais

### 17.1 Fluxo de Boas-vindas

1. INIT
2. Identificação do usuário
3. Apresentação curta
4. Direcionamento (menu implícito)

---

### 17.2 Fluxo FAQ

- Entrada por intenção detectada
- Resposta direta por regra
- Fallback para IA
- Retorno ao AUTO_ATTENDANCE

---

### 17.3 Fluxo de Agendamento

1. Coleta de serviço
2. Coleta de data
3. Verificação de disponibilidade
4. Confirmação explícita
5. Persistência

Nunca assumir ações sem confirmação.

---

### 17.4 Fluxo de Escalonamento Humano

Disparado quando:
- IA falha repetidamente
- Solicitação sensível
- Palavra-chave crítica
- Pedido explícito

Estado muda para HUMAN_HANDOFF.

---

## 18. Contratos Internos (IA não é livre)

### 18.1 Contrato de Entrada da IA

A IA recebe apenas:
- Resumo do contexto
- Última mensagem
- Objetivo atual

Nunca recebe:
- Histórico completo
- Dados sensíveis crus

---

### 18.2 Contrato de Saída da IA

A IA **nunca responde direto ao usuário**.

Ela retorna:
- Intenção
- Entidades
- Sugestão de resposta
- Grau de confiança

O Orquestrador decide o que fazer.

---

## 19. Requisitos Não-Funcionais (Obrigatórios)

### 19.1 Performance
- Resposta < 3s
- Cache de respostas comuns

### 19.2 Confiabilidade
- Retry controlado
- Idempotência
- Dead-letter queue

### 19.3 Observabilidade
- Trace por conversa
- Métricas por estado
- Auditoria de decisões

---

## 20. Políticas de Segurança e Comportamento

- Opt-out imediato
- Linguagem neutra
- Sem diagnósticos, conselhos legais ou médicos
- Nunca inventar informações

---

## 21. Critérios de Pronto para Codificação

Antes de escrever código, deve existir:

✔ Estados definidos
✔ Fluxos mapeados
✔ Contratos da IA
✔ Regras críticas documentadas
✔ Política LGPD
✔ Métricas definidas

---

## 23. Perfil Profissional da Secretária Virtual

### 23.1 Postura e Linguagem

A secretária virtual deve:
- Ser educada, clara e objetiva
- Evitar jargões técnicos com usuários finais
- Não usar emojis em excesso
- Manter tom neutro e profissional

Configurações possíveis (parametrizáveis):
- Formal / Semi-formal
- Proativa / Reativa
- Respostas curtas / Respostas explicativas

---

### 23.2 Princípios de Comunicação

- Nunca assumir intenções
- Sempre confirmar ações críticas
- Priorizar clareza sobre criatividade
- Repetir informações importantes

---

## 24. Limites Operacionais da IA

### 24.1 O que a IA PODE fazer

- Classificar intenções
- Extrair entidades (datas, serviços, nomes)
- Sugerir respostas
- Reformular mensagens

### 24.2 O que a IA NUNCA pode fazer

- Confirmar agendamentos
- Cancelar compromissos
- Executar ações irreversíveis
- Tomar decisões finais

Toda ação real exige validação do Orquestrador.

---

## 25. Política de Erro, Fallback e Escalonamento

### 25.1 Tipos de Erro

- Erro de entendimento
- Erro de contexto
- Erro técnico
- Erro de integração externa

---

### 25.2 Estratégia de Fallback

1ª falha → pedir reformulação
2ª falha → resposta guiada
3ª falha → escalar humano

Nunca insistir indefinidamente.

---

### 25.3 Escalonamento Humano

Disparado automaticamente quando:
- Confiança da IA < limiar
- Palavra-chave sensível
- Pedido explícito
- Loop detectado

---

## 26. Governança Conversacional

### 26.1 Controle de Qualidade

- Avaliação periódica de conversas
- Ajuste de regras
- Atualização de prompts

---

### 26.2 Versionamento Conversacional

- Fluxos versionados
- Prompts versionados
- Rollback rápido

---

## 27. Métricas e Indicadores (KPIs)

### 27.1 Métricas Operacionais

- Tempo médio de resposta
- Taxa de escalonamento
- Taxa de erro
- Conversas resolvidas sem humano

---

### 27.2 Métricas de Qualidade

- Satisfação do usuário
- Repetição de perguntas
- Abandono de conversa

---

## 28. Conformidade Legal e Ética

- Consentimento explícito
- Opt-out imediato
- Logs anonimizados
- Retenção limitada

---

## 29. Checklist Final de Projeto Profissional

✔ Arquitetura definida
✔ Estados mapeados
✔ Fluxos documentados
✔ Limites da IA claros
✔ Métricas definidas
✔ Segurança e LGPD

---

## 30. Estado do Projeto

Este documento agora representa um **projeto pronto para implementação**, com riscos conhecidos, decisões arquiteturais tomadas e comportamento claramente definido.

O próximo passo recomendado é a criação de **diagramas visuais e fluxos gráficos**, seguidos da codificação.

