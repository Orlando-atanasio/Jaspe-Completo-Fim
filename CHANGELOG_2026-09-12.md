# JASPE — Mudanças aplicadas em 12/09/2026

## O que foi corrigido

1. **Token da Brapi configurável pelo usuário** (não existia antes).
   - Novo card "Cotações de Ativos (Brapi)" na tela de **Perfil** (o mesmo
     modal do avatar/foto).
   - Campo para colar o token, botão **Testar Token** (chamada real à Brapi
     com o ticker WEGE3 — que só responde se o token for válido) e botão
     **Salvar Token**.
   - Link direto para `brapi.dev/dashboard` (cadastro grátis).
   - Guardado em `localStorage` (`jaspe_brapi_token`), separado do backup
     de perfil — sobrevive a updates do app e pode ser trocado a qualquer
     momento sem nova build.
   - Aviso amarelo na aba **Carteira** quando não há token configurado,
     com atalho direto pro Perfil.

2. **Premissa corrigida em `utils/finance.ts`**: sem token, a Brapi só
   libera 4 tickers de teste (PETR4, MGLU3, VALE3, ITUB4) — não "B3 geral"
   como o comentário antigo dizia. Comentários e lógica atualizados pra
   refletir isso.

3. **`CapacitorHttp` habilitado no Android** (`capacitor.config.ts`).
   Na build nativa, as chamadas ao Yahoo agora saem pela ponte nativa do
   Android (bypassa CORS de verdade) em vez de depender só dos proxies
   públicos (`allorigins.win`, `cors.lol`, `codetabs.com`). A versão
   web/PWA continua usando os proxies, pois isso só é possível dentro do
   APK.

4. **Bug de tipo pré-existente corrigido** em `App.tsx` (lógica de alarme
   repetido) — `Map.get()` podia retornar `undefined` sem checagem; agora
   tem guarda explícita. Não era um bug visível em uso normal, mas o
   `tsc --noEmit` acusava.

## Verificação feita

- `npx tsc --noEmit` → **0 erros**.
- `npx vite build` → **build de produção concluído com sucesso** (mesmos
  avisos de bundle grande que já existiam antes, não relacionados a essas
  mudanças).

## Como aplicar

1. Extraia este zip por cima da pasta do projeto (ou substitua os arquivos
   alterados: `src/utils/finance.ts`, `src/App.tsx`,
   `src/components/GlobalModals.tsx`, `src/components/CarteiraView.tsx`,
   `capacitor.config.ts`, `DECISOES_JASPE.md`).
2. `npm install` (o zip não inclui `node_modules` nem `android/*/build`
   pra ficar leve — são gerados de novo).
3. `npm run build`
4. `npx cap sync android` (necessário pra aplicar o `CapacitorHttp` no
   projeto Android gerado).
5. Gere o APK normalmente pelo Android Studio ou `./gradlew assembleDebug`.
6. Abra o app → toque no avatar → cole um token grátis da Brapi → **Testar
   Token** → **Salvar Token**.

## O que NÃO mudou

- Nenhuma lógica de negócio, layout de telas, cofre, notas, tarefas,
  contatos, backup ou parser de corretagem foi alterada.
- A cadeia de fallback (Brapi → CoinGecko → Yahoo → cache) continua a
  mesma, só ficou mais robusta e configurável.

---

## Atualização — mesmo dia, rodada 2: limpeza de documentação e scaffold

1. **Removidos** (lixo do template original do Google AI Studio, sem
   nenhuma referência no código real):
   - `README.md` antigo (falava em `GEMINI_API_KEY`/AI Studio).
   - `.env.example` (mesma origem).
   - `LAUDO_AUDITORIA_SENIOR_JASPE_CONSOLIDADO.md` — comparava o app contra
     uma especificação com backend Express + SQLite que não será
     perseguida; a arquitetura 100% client-side (`localStorage`) é a
     decidida e definitiva pro projeto.
   - Dependências mortas do `package.json`: `@google/genai`, `dotenv`,
     `tsx` (zero `import`/uso em todo o `src/`). Removidas via
     `npm uninstall`, então `package-lock.json` já está consistente.
   - Corrigido também o script `"clean"`, que apagava um `server.js`
     inexistente (resto do mesmo scaffold).
   - `"name"` do `package.json` corrigido de `"react-example"` (genérico)
     para `"jaspe"`; `"version"` de `0.0.0` para `1.0.0`.

2. **`README.md` reescrito do zero** com instruções reais: rodar em dev,
   build web, gerar o APK via Capacitor, como configurar o token da Brapi,
   e um mapa rápido das pastas.

3. **Mantidos**: `DECISOES_JASPE.md` (decisões nº 24 e 25 registradas) e
   `CORRECOES_AUDITORIA_2026-09-11.md` (histórico de bugs da auditoria
   anterior).

### Verificação desta rodada

- `npx tsc --noEmit` → **0 erros**, mesmo depois de remover as 3 deps.
- `npx vite build` → **build de produção concluído**, mesmos avisos de
  bundle grande de sempre (não relacionados a esta limpeza).

