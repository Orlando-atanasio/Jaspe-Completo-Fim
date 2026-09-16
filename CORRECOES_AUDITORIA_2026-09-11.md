# Correções aplicadas — Auditoria técnica sênior (11/09/2026)

Revisão completa do código-fonte (~13,9 mil linhas), compilação TypeScript
(`tsc --noEmit`) e reprodução isolada de cada bug antes da correção.
`node_modules/` foi removido deste pacote para reduzir tamanho — rode
`npm install` (ou `bun install`) antes de `npm run dev` / `npm run build`.

## Bugs corrigidos

### 1. Corrupção de arquivo quebrando o build — `src/components/EditTaskDrawer.tsx`
Havia uma linha de texto solto no meio do JSX (linha 391), sem relação com o
código ao redor, que quebrava o parser do TypeScript e impedia `tsc`/`vite
build` de rodar. **Removida.** `tsc --noEmit` agora passa com 0 erros.

### 2. Corrupção silenciosa de dados na restauração de backup — `src/utils/backup.ts`
**Severidade: alta.** A função `dedupMerge` usava `merged.unshift(...)` dentro
do laço de importação para inserir itens novos, mas os índices guardados em
`byId`/`byUuid` nunca eram atualizados após o deslocamento causado pelo
`unshift`. A partir do segundo item novo processado num mesmo backup, qualquer
atualização de item já existente passava a escrever na posição errada do
array — sobrescrevendo silenciosamente um contato/nota/tarefa/ativo/documento
não relacionado.

Reproduzido isoladamente (backup com 1 item novo + 1 atualização de item
existente → o item novo perdia seu próprio conteúdo, e o item que deveria ser
atualizado ficava intocado). Afetava toda restauração de backup que mistura
itens novos com atualizações — cenário comum.

**Correção:** trocado `unshift` por `push` durante o laço (não desloca
índices existentes); a ordem "mais novo primeiro" é reconstituída só depois
que todas as atualizações por índice já terminaram. Validado com reprodução
automatizada antes/depois da correção.

### 3. "Parar alarme" não funcionava em lembretes com repetição — `src/App.tsx`
`repeatAlarmsCache` é um `Map<number, {...}>`, mas o código tentava limpar uma
entrada com `repeatAlarmsCache.current[id] = undefined` (sintaxe de objeto
comum) — isso não remove nada de um `Map`; `.has()`/`.get()` continuavam
enxergando a entrada antiga. Resultado: ao tocar em "Parar" ou "Concluir" num
alarme com repetição, o cronômetro de repetição nunca era de fato cancelado
e a tarefa voltava a tocar no ciclo seguinte.

**Correção:** trocado para `repeatAlarmsCache.current.delete(id)` (linhas
onde a ação `conclude` e `stop` limpam o cache), que é a chamada correta da
API de `Map`.

*Causa raiz observada:* `tsconfig.json` não tem `"strict": true` nem
`"noImplicitAny"`. Com essas opções ativadas, indexar um `Map` com colchetes
normalmente gera erro de compilação — o bug teria sido pego antes de chegar
em produção. Recomendo avaliar ativar `strict` no `tsconfig.json` (fora do
escopo desta correção pontual, pois pode revelar outros pontos a ajustar em
todo o projeto).

## Funcionalidade implementada/completada (pedido do usuário — mesma sessão)

O usuário relatou que havia pedido, num momento anterior, a implementação de:
antecedência de alarme configurável (15min/30min/1 dia/2 dias/personalizado)
e repetição do alerta até o usuário agir (concluir, soneca, parar). Essa foi
justamente a área onde a corrupção do item 1 apareceu — então a funcionalidade
estava incompleta/quebrada. Implementei o que faltava:

### 4. Antecedência de alarme com opção personalizada — `src/components/EditTaskDrawer.tsx`
Antes só existia: Na hora / 30min / 1h / 1 dia / 2 dias. Adicionado **15 min**
e um campo **"Personalizado"** onde o usuário digita qualquer valor em minutos
(0 a 10080 = 7 dias, mesmo limite já validado em `clampRemindBeforeMin`).

### 5. Repetição do alerta até o usuário agir — `src/components/EditTaskDrawer.tsx`
A versão anterior tinha **dois checkboxes duplicados e conflitantes** ligados
à mesma variável (`repeatEveryMin > 0`) — um pra ligar, outro pra desligar a
mesma coisa — sem opção de escolher o intervalo (fixo em 1h). Substituí por um
seletor único com as opções pedidas: Não repetir / 5 min / 10 min / 15 min /
30 min / 1h. Além disso, ao ligar o alarme pela primeira vez, o app agora
sugere automaticamente repetição a cada 10 min (sem sobrescrever escolha já
feita pelo usuário), para que "repetir até concluir/adiar/parar" seja o
comportamento padrão, como pedido.

### 6. Soneca com múltiplas durações — `src/components/GlobalModals.tsx` + `src/App.tsx`
Só existia soneca fixa de 10 minutos. Agora a tela do alarme tocando oferece
**5 / 10 / 15 / 30 minutos**, e `onDismissAlarm('snooze', minutos)` aplica o
valor escolhido. De quebra, corrigido um bug relacionado: a soneca antiga
desativava o alarme da tarefa (`alarm: false`) em vez de apenas adiar o
horário — o que significava que, depois de uma soneca, o alarme **nunca mais
tocaria de novo** para aquela tarefa. Agora o alarme continua ativo e volta a
tocar no novo horário.

### 7. Alarme nativo (2º plano) não se atualizava ao editar a tarefa — `src/utils/notify.ts`
Bug relacionado, encontrado ao revisar esta área: a função que sincroniza
alarmes com o sistema Android calculava quais notificações estavam
desatualizadas (`toCancel`), mas **nunca chamava o cancelamento** — a
variável era calculada e descartada. Resultado: editar a antecedência ou a
data de uma tarefa com alarme nativo já agendado não tinha efeito nenhum em
segundo plano (app minimizado/fechado); o alarme antigo, com a hora errada,
continuava valendo. Corrigido para cancelar de fato os desatualizados antes
de reagendar com o novo horário.

## Observações arquiteturais (não corrigidas — decisão de produto/escopo)

- **Cotações financeiras (`src/utils/finance.ts`)** dependem de proxies CORS
  públicos de terceiros (`allorigins.win`, `cors.lol`, `codetabs.com`) para
  acessar a Yahoo Finance no navegador. O código já valida faixa de preço e
  plausibilidade vs. cache, mas a disponibilidade em si é uma dependência
  externa fora do controle do projeto.
- **Dois lockfiles simultâneos** (`package-lock.json` e `bun.lock`) — risco
  de builds divergentes conforme o gerenciador de pacotes usado. Recomenda-se
  manter apenas um.
- **Dependência `@google/genai` e variável `GEMINI_API_KEY`** em
  `.env.example` sem uso em `src/` — resquício de template, sem função atual.
- O `LAUDO_AUDITORIA_SENIOR_JASPE_CONSOLIDADO.md`, já presente no projeto,
  cobre gaps de escopo/arquitetura (SQLite, alarmes nativos homologados,
  sandbox de mídia) e continua válido — é uma camada diferente desta
  correção, que tratou de bugs concretos no código como estava.
