# DECISÕES DO JASPE — livro imutável de decisões de produto

> REGRA DE OURO: nada listado aqui como DECIDIDO pode ser removido,
> revertido ou redesenhado sem (1) consultar este arquivo, (2) avisar
> "isso desfaz a decisão Nº X, tem certeza?", (3) receber "sim" explícito
> e (4) registrar a revogação abaixo com data e motivo.
> Andar para trás sem registro é proibido.

Formato: `Nº | DATA | DECISÃO | ONDE VALE | STATUS`

---

## Vigentes

| Nº | Data | Decisão | Onde vale | Status |
|----|------|---------|-----------|--------|
| 01 | 2026-09-08 | Topo de Contatos tem 3 botões: WhatsApp · Telegram · Novo; cada canal abre o disparo já no canal | `ContactsView` fileira de ações | DECIDIDO |
| 02 | 2026-09-08 | Modal Disparar tem pílulas WhatsApp/Telegram + envio real (wa.me com telefone; t.me com @ ou share) | `GlobalModals` | DECIDIDO |
| 03 | 2026-09-08 | Ficha de contato tem campo Telegram (@usuário); com @ abre chat direto, sem @ usa compartilhamento | `EditContactModal`, ficha detalhada, disparo | DECIDIDO |
| 04 | 2026-09-08 | Fichas/modais abrem POR CIMA (top sheet), nunca coladas no rodapé (teclado Android) | contato, senha, ativo, PDF, mensagem, backup, perfil, relatório | DECIDIDO |
| 05 | 2026-09-08 | Gaveta de tarefa desliza da direita, fecha no X, fora, salvar e arrasto p/ direita | `EditTaskDrawer` | DECIDIDO |
| 06 | 2026-09-08 | Caixinha de categoria abre card com 🗑 ao lado de CADA nome + "Criar nova categoria" no rodapé do mesmo card | `CategoryField` (cofre, contatos, ativos, importação, notas) | DECIDIDO |
| 07 | 2026-09-08 | Nos formulários o card de categoria ESTICA o formulário (modo expand); na barra de notas é flutuante | `CategoryField expand` | DECIDIDO |
| 08 | 2026-09-08 | Card de categoria um pouco maior (linhas e área de rolagem) | `CategoryField` | DECIDIDO |
| 09 | 2026-09-08 | Categorias de notas usam a mesma lista/mecânica (kind notas, sem "Todas") | `OneNoteEditor` | DECIDIDO |
| 10 | 2026-09-08 | Cofre: bootstrap de PIN 4–6 (nunca fixo), AES-256-GCM + PBKDF2, auto-lock 2min, busca interna, olho em todos os modos | `CofreView`, `App` vault | DECIDIDO |
| 11 | 2026-09-08 | Carteira detalhada = tabela completa rolável (checkbox, lote, TOTAIS) com deslize de dedo, SEM setas e SEM barra visível | `CarteiraView` detailed | DECIDIDO |
| 12 | 2026-09-08 | Exportações dobradas em "Exportar ▾" (Excel/CSV/PDF); Bola de Neve é botão que acende, abre rolando até o painel e fecha no toque/empurrão p/ cima, SEM setinha | `CarteiraView` | DECIDIDO |
| 13 | 2026-09-08 | Métricas sempre reais, nunca fixas (retorno, pizza, contadores, badges) | Dashboard, Drawer, Carteira | DECIDIDO |
| 14 | 2026-09-08 | Editor de nota abre em LEITURA (tabela/slides/folha); lápis edita; planilha tem grade com ＋linha/＋coluna | `OfficeDocEditor` | DECIDIDO |
| 15 | 2026-09-08 | Player de slides tem SAIR vermelho + ESC + Encerrar; impossível ficar preso | `OfficeDocEditor` | DECIDIDO |
| 16 | 2026-09-08 | Planilha exemplo rica (9×5) + migração corrige demos antigos e tipos pelo formato | `initialData`, `App` | DECIDIDO |
| 17 | 2026-09-08 | Salvamento é upsert com id fixo (autosave atualiza, nunca duplica, nunca some) | `App` + 4 fichas | DECIDIDO |
| 18 | 2026-09-08 | Backup granular AES com restore por seção + dedup SHA sem colisão; Yahoo real com fallback; CSV/XLS reais; Bola de Neve real | núcleo | DECIDIDO |
| 19 | 2026-09-08 | Logo em `/logo.svg` no header, drawer e favicon | `public/logo.svg`, `index.html` | DECIDIDO |
| 20 | 2026-09-08 | Checklist da nota com lista rolável e Add sempre visível; barra em 2 linhas legendadas; 10 cores | `OneNoteEditor` | DECIDIDO |
| 21 | 2026-09-09 | Telegram tenta o app instalado primeiro (`tg://`) e só cai no site se não abrir; com @ copia o texto de reserva. Emenda às Nº 02/03 — fallback https preservado, nada removido | `utils/share`, ficha, disparo | DECIDIDO |
| 22 | 2026-09-09 | Caixinha de categoria no visual do print: pílula creme, card com bolinhas, contadores por categoria, lixeira sutil, criar tracejado. Emenda à Nº 06 — comportamento igual | `CategoryField` + contadores | DECIDIDO |
| 23 | 2026-09-09 | Cotações reais: Brapi p/ B3, CoinGecko p/ cripto (BRL), Yahoo direto como fallback; botão "Atualizar carteira" com sucesso/falha/já-atualizada | `utils/finance`, `App`, `CarteiraView` | DECIDIDO |
| 24 | 2026-09-12 | Correção de premissa da Nº 23: Brapi sem token só libera 4 tickers de teste (PETR4/MGLU3/VALE3/ITUB4), não "B3 geral". Token da Brapi agora configurável pelo próprio usuário na tela de Perfil (localStorage `jaspe_brapi_token`, com botão "Testar Token" que faz chamada real). `CapacitorHttp` habilitado no Android: Yahoo passa a ser chamado direto (sem proxy CORS público) só na build nativa; web/PWA mantém a cascata de proxies como estava | `utils/finance`, `capacitor.config.ts`, `GlobalModals` (card Perfil), `CarteiraView` (aviso), `App` | DECIDIDO |
| 25 | 2026-09-12 | Limpeza de resíduos do scaffold original (AI Studio/Gemini), nunca usados pelo app real: removidos `README.md` genérico, `.env.example` (GEMINI_API_KEY/APP_URL) e as deps mortas `@google/genai`, `dotenv`, `tsx` do `package.json` (zero referências no código). `README.md` reescrito com instruções reais do JASPE (dev, build, APK, config. de token Brapi). Removido também `LAUDO_AUDITORIA_SENIOR_JASPE_CONSOLIDADO.md` — comparava o app contra uma spec com backend Express/SQLite que não será perseguida; arquitetura 100% client-side (`localStorage`) é a decidida e definitiva | raiz do projeto, `package.json` | DECIDIDO |

## Revogadas (histórico — não reimplementar sem nova decisão)

| Nº | Data | O que foi desfeito e por quê |
|----|------|------------------------------|
| — | — | (nenhuma até aqui) |

## Procedimento obrigatório antes de qualquer remoção/mudança visível

1. Localizar a decisão acima.
2. Avisar: "isso desfaz a decisão Nº __ (resumo). Tem certeza?"
3. Só executar com "sim" explícito.
4. Mover a linha para Revogadas com data/motivo e numerar a nova decisão.
