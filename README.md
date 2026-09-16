# JASPE

Aplicativo pessoal de organização e finanças — notas, tarefas, contatos,
carteira de investimentos, cofre de credenciais e Office Studio, com backup
criptografado e cotações de ativos em tempo real. Frontend React + Vite,
empacotado para Android via Capacitor. Sem backend: todos os dados ficam no
próprio aparelho (`localStorage`).

## Requisitos

- Node.js 18 ou superior
- Para gerar o APK: Android Studio + JDK 17

## Rodando localmente (navegador)

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

## Build de produção (web)

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve o build localmente pra conferir
```

## Gerando o APK (Android)

```bash
npm run build
npx cap sync android
```

Depois abra a pasta `android/` no Android Studio e gere o APK/Bundle
normalmente (Build → Generate Signed Bundle/APK), ou pela linha de comando:

```bash
cd android
./gradlew assembleDebug     # ou assembleRelease, com assinatura configurada
```

## Cotações de ativos (Carteira)

O app busca preços em cascata: **Brapi** (ações/FIIs da B3) → **CoinGecko**
(cripto, sem chave) → **Yahoo Finance** (reserva) → último preço em cache.

Sem token, a Brapi só atualiza 4 tickers de teste (PETR4, MGLU3, VALE3,
ITUB4). Para liberar todos os seus ativos B3, pegue um token grátis em
[brapi.dev/dashboard](https://brapi.dev/dashboard) e cole em **Perfil**
(toque no avatar) → **Cotações de Ativos (Brapi)**. Dá pra testar o token
ali mesmo antes de salvar.

## Verificação antes de empacotar

```bash
npm run lint    # tsc --noEmit — checagem de tipos, sem gerar arquivos
npm run build   # falha se houver erro real de build
```

## Estrutura

```
src/
  components/   telas e modais
  store/        estado global (Zustand) — dados principais + cofre
  utils/        cotações, criptografia, backup, parser de nota de corretagem
  data/         seeds/dados iniciais
android/        projeto nativo gerado pelo Capacitor
```

## Documentação interna

- `DECISOES_JASPE.md` — histórico de decisões de produto/arquitetura.
  Antes de remover ou mudar algo visível, confira ali primeiro.
