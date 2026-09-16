import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Task } from './types';
import { playSynthSound } from './utils/audio';
import { ensureAlarmPermission, fireAlarmNotification, syncNativeAlarms, cancelNativeAlarm, getAlarmTime, clampRepeatEveryMin } from './utils/notify';
import { initNativeShell } from './utils/native';
import { useMainStore } from './store/useMainStore';
import { useVaultStore } from './store/useVaultStore';

import StatusBar from './components/StatusBar';
import Header from './components/Header';
import Drawer from './components/Drawer';
import FooterNav from './components/FooterNav';
import FABRadial from './components/FABRadial';

import DashboardView from './components/DashboardView';
import NotesView from './components/NotesView';
import OneNoteEditor from './components/OneNoteEditor';
import ContactsView from './components/ContactsView';
import EditContactModal from './components/EditContactModal';
import CofreView from './components/CofreView';
import EditCredentialModal from './components/EditCredentialModal';
import CarteiraView from './components/CarteiraView';
import PDFImportModal from './components/PDFImportModal';
import EditAssetModal from './components/EditAssetModal';
import TasksView from './components/TasksView';
import EditTaskDrawer from './components/EditTaskDrawer';
import OfficeStudioView from './components/OfficeStudioView';
import OfficeDocEditor from './components/OfficeDocEditor';

import GlobalModals from './components/GlobalModals';
import TrashModal from './components/TrashModal';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  // Main Store State & Actions
  const {
    notes,
    contacts,
    tasks,
    assets,
    proventos,
    documents,
    profile,
    isLightTheme,
    currentTab,
    isDrawerOpen,
    activeEditorNoteId,
    activeOfficeDocId,
    isContactModalOpen,
    activeContactModalId,
    isCredentialModalOpen,
    activeCredentialModalId,
    isAssetModalOpen,
    activeAssetModalId,
    isPDFImportModalOpen,
    isTaskDrawerOpen,
    activeTaskId,
    isSearchModalOpen,
    isMessageModalOpen,
    messageChannel,
    isBackupModalOpen,
    isProfileModalOpen,
    isReportModalOpen,
    isDocCreateOpen,
    docEditorStartsEditing,
    alarmQueue,
    toastMessage,
    isYahooSyncing,
    lastSyncInfo,
    isFullScreenPhone,

    showToast,
    triggerConfetti,
    selectTab,
    toggleTheme,
    openDrawer,
    closeDrawer,
    setIsFullScreenPhone,

    createNewNote,
    togglePinNote,
    saveActiveNote,
    deleteNote,
    scheduleNote,
    migrateNoteCategory,
    saveScratchpadAsNote,
    setActiveEditorNoteId,

    saveContact,
    deleteContact,
    toggleFavoriteContact,

    toggleTask,
    moveTaskStatus,
    saveTask,
    deleteTask,
    setAlarmQueue,
    setTasks,

    saveAsset,
    deleteAsset,
    triggerYahooSync,

    openDoc,
    saveOfficeDoc,
    deleteDoc,
    unlinkDoc,
    createDocWith,
    createDoc,
    setActiveOfficeDocId,
    openDocCreate,
    closeDocCreate,

    saveProfile,
    handleFABAction,

    openContactModal,
    closeContactModal,
    openCredentialModal,
    closeCredentialModal,
    openAssetModal,
    closeAssetModal,
    openPDFImportModal,
    closePDFImportModal,
    openTaskDrawer,
    closeTaskDrawer,
    openSearchModal,
    closeSearchModal,
    toggleSearchModal,
    openMessageModal,
    closeMessageModal,
    openBackupModal,
    closeBackupModal,
    openProfileModal,
    closeProfileModal,
    openReportModal,
    closeReportModal,
    isTrashOpen,
    trashItems,
    openTrashModal,
    closeTrashModal,
    restoreTrashItem,
    deleteTrashItem,
    emptyTrash,

    exportJSON,
    exportEncryptedJaspe,
    importBackupFile,
    consumeSharedText,
  } = useMainStore();

  // Vault Store State & Actions
  const {
    credentials,
    isCofreUnlocked,
    vaultMeta,
    setupPin,
    unlockVault,
    lockVault,
    verifyCurrentPin,
    changePin,
    failedAttempts,
    lockoutUntil,
    saveCredential,
    deleteCredential,
    initAutoLock,
  } = useVaultStore();

  const hasPinSetup = !!vaultMeta;

  // Vault auto-lock listener (2min inatividade / app oculto)
  useEffect(() => {
    const cleanup = initAutoLock();
    return cleanup;
  }, [initAutoLock]);

  // BUGFIX: botão/gesto "Voltar" do Android — antes minimizava o app sempre,
  // mesmo com drawer/editor/modal aberto (initNativeShell era chamado em
  // main.tsx sem passar onBack, então App.minimizeApp() rodava incondicionalmente).
  // Agora fecha, em ordem de prioridade, o que estiver na frente; só deixa
  // minimizar quando não há nada aberto. Usamos um ref para o handler sempre
  // enxergar o estado mais recente sem precisar re-registrar o listener nativo
  // a cada render (App.addListener é chamado 1x, no mount).
  const onBackRef = useRef<() => boolean>(() => false);
  onBackRef.current = () => {
    if (isSearchModalOpen) { closeSearchModal(); return true; }
    if (isMessageModalOpen) { closeMessageModal(); return true; }
    if (isBackupModalOpen) { closeBackupModal(); return true; }
    if (isProfileModalOpen) { closeProfileModal(); return true; }
    if (isReportModalOpen) { closeReportModal(); return true; }
    if (isTrashOpen) { closeTrashModal(); return true; }
    if (isPDFImportModalOpen) { closePDFImportModal(); return true; }
    if (isTaskDrawerOpen) { closeTaskDrawer(); return true; }
    if (isAssetModalOpen) { closeAssetModal(); return true; }
    if (isCredentialModalOpen) { closeCredentialModal(); return true; }
    if (isContactModalOpen) { closeContactModal(); return true; }
    if (activeOfficeDocId !== null) { setActiveOfficeDocId(null); return true; }
    if (activeEditorNoteId !== null) { setActiveEditorNoteId(null); return true; }
    if (isDrawerOpen) { closeDrawer(); return true; }
    return false; // nada aberto: deixa o Android minimizar o app normalmente
  };
  useEffect(() => {
    void initNativeShell({ onBack: () => onBackRef.current() });
  }, []);

  // Altura visível real (anti-dvh-sob-zoom): o zoom na raiz NÃO encolhe o
  // layout viewport que innerHeight/dvh medem — a área visível de verdade é
  // altura ÷ zoom. Trava a carcaça nessa medida (lendo o zoom do próprio CSS,
  // acompanha qualquer valor futuro sem hardcode).
  useEffect(() => {
    const apply = () => {
      let zoom = 1;
      try {
        const z = parseFloat(getComputedStyle(document.documentElement).zoom || '');
        if (Number.isFinite(z) && z > 0) zoom = z;
      } catch {}
      const h = Math.round((window.innerHeight || 0) / zoom);
      if (h > 0) document.documentElement.style.setProperty('--app-h', `${h}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      vv?.removeEventListener('resize', apply);
    };
  }, []);

  // Alarms
  const ringingTask = alarmQueue.length > 0 ? alarmQueue[0] : null;
  const triggeredAlarmsRef = useRef<Record<number, boolean>>({});
  const alarmBeepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cache de repetição: id -> {repeatMin, nextAt, firedAt}
  const repeatAlarmsCache = useRef<Map<number, { repeat: number; nextAt: Date; firedAt: Date }>>(new Map());

  // BUGFIX [A4]: ref estável para as tarefas — o interval de polling lê
  // sempre a versão mais atual sem precisar resetar o setInterval a cada
  // mutação de tarefa (o que impedia alarmes de disparar durante uso ativo).
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    ensureAlarmPermission()
      .then((ok) => { if (!ok) showToast('Ative as notificações p/ alarmes em 2º plano (sistema + navegador).'); })
      .catch(() => {});
  }, [showToast]);

  // Espelha alarmes futuros p/ o agendador nativo (toca com app minimizado/morto).
  // O polling web abaixo continua como fallback p/ app aberto.
  useEffect(() => {
    void syncNativeAlarms(tasks);
  }, [tasks]);

  // BUGFIX [A10]: limpa flags de alarme para tarefas editadas/excluídas.
  // Sem isso, se o usuário mudasse a data de uma tarefa que já tocou,
  // o alarme nunca mais dispararia (a flag `true` ficava permanente).
  useEffect(() => {
    const currentIds = new Set(tasks.map(t => t?.id).filter(Boolean));
    for (const idStr of Object.keys(triggeredAlarmsRef.current)) {
      const id = Number(idStr);
      if (!currentIds.has(id)) {
        delete triggeredAlarmsRef.current[id];
        repeatAlarmsCache.current.delete(id);
        continue;
      }
      const task = tasks.find(t => t?.id === id);
      if (task && !task.alarm) {
        delete triggeredAlarmsRef.current[id];
        repeatAlarmsCache.current.delete(id);
      }
    }
  }, [tasks]);

  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      tasksRef.current.forEach((task) => {
        if (!task || typeof task !== 'object') return;
        if (!task.alarm || task.done || !task.dateISO) return;
        if (triggeredAlarmsRef.current[task.id]) return; // já tocou esta rodada (repetição é via cronômetro próprio)
        
        // Calcula hora efetiva = prazo - antecedência
        const effectiveAt = getAlarmTime(task.dateISO, task.remindBeforeMin);
        if (!effectiveAt) return; // tarefa antiga sem dateISO válida ou remindBeforeMin

        // Verifica se agora >= hora efetiva (dentro de janela de 5 min tolerância)
        const diff = now.getTime() - effectiveAt.getTime();
        if (diff >= -300000 && diff < 0) { // dentro de 5min antes do horário efetivo até o horário
          triggeredAlarmsRef.current[task.id] = true;
          triggerAlarm(task);
          // Se tem repetição, agenda próximo ciclo via cronômetro próprio (não depende de polling)
          if (task.repeatEveryMin && task.repeatEveryMin > 0) {
            const repeat = clampRepeatEveryMin(task.repeatEveryMin);
            const nextAt = new Date(effectiveAt.getTime() + repeat * 60000);
            repeatAlarmsCache.current.set(task.id, { repeat, nextAt, firedAt: now });
          }
          return;
        }

        // Se tem repetição e já foi disparado uma vez, verifica cronômetro próprio
        if (task.repeatEveryMin && task.repeatEveryMin > 0 && repeatAlarmsCache.current.has(task.id)) {
          const cached = repeatAlarmsCache.current.get(task.id);
          if (!cached) return;
          const now2 = new Date();
          if (now2.getTime() >= cached.nextAt.getTime()) {
            triggeredAlarmsRef.current[task.id] = true;
            triggerAlarm(task);
            cached.nextAt = new Date(cached.nextAt.getTime() + cached.repeat * 60000);
            cached.firedAt = now2;
            repeatAlarmsCache.current.set(task.id, cached);
          }
        }
      });
    };
    const interval = setInterval(checkAlarms, 5000);
    return () => { clearInterval(interval); };
  }, []);

  const triggerAlarm = (task: Task) => {
    setAlarmQueue((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]));
    playSynthSound('alarm');
    void fireAlarmNotification(task.text, task.date || 'Alarme JASPE', task.id);
    // NÃO cancela o native alarm se houver repetição: deixa o scheduler nativo tentar o próximo ciclo.
    // Se não houver repetição, cancela como antes.
    if (!(task.repeatEveryMin && task.repeatEveryMin > 0)) {
      void cancelNativeAlarm(task.id);
    }
    if (alarmBeepIntervalRef.current) clearInterval(alarmBeepIntervalRef.current);
    alarmBeepIntervalRef.current = setInterval(() => { playSynthSound('alarm'); }, 1200);
  };

const handleDismissAlarm = (action: 'conclude' | 'snooze' | 'stop', snoozeMin: number = 10) => {
    if (alarmBeepIntervalRef.current) {
      clearInterval(alarmBeepIntervalRef.current);
      alarmBeepIntervalRef.current = null;
    }
    if (!ringingTask) return;

    if (action === 'conclude') {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === ringingTask.id
            ? { ...t, done: true, status: 'Concluída' }
            : t
        )
      );
      triggerConfetti();
      showToast(`Tarefa "${ringingTask.text}" concluída com sucesso!`);
      // Se tem repetição, limpa cache e cancela native alarm
      if (ringingTask.repeatEveryMin && ringingTask.repeatEveryMin > 0) {
        repeatAlarmsCache.current.delete(ringingTask.id);
        void cancelNativeAlarm(ringingTask.id);
      }
      delete triggeredAlarmsRef.current[ringingTask.id];
    } else if (action === 'snooze') {
      // Soneca: redefine o dateISO para +N min a partir de agora (N escolhido
      // pelo usuário no momento do alarme: 5, 10, 15, 30... via snoozeMin).
      const mins = Number.isFinite(snoozeMin) && snoozeMin > 0 ? Math.floor(snoozeMin) : 10;
      const snoozeTime = new Date(Date.now() + mins * 60000);
      const iso = snoozeTime.toISOString().slice(0, 16);
      const dateStr = `${snoozeTime.toLocaleDateString('pt-BR')} ${snoozeTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      delete triggeredAlarmsRef.current[ringingTask.id];
      // Soneca também encerra qualquer ciclo de repetição em curso (senão o
      // alarme antigo poderia voltar a tocar no meio da soneca).
      if (ringingTask.repeatEveryMin && ringingTask.repeatEveryMin > 0) {
        repeatAlarmsCache.current.delete(ringingTask.id);
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === ringingTask.id
            ? { ...t, dateISO: iso, date: dateStr, remindBeforeMin: 0, alarm: true } // mantém alarme ativo, sem antecedência: dispara exatamente em +N min
            : t
        )
      );
      showToast(`Soneca ativada por ${mins} minuto${mins === 1 ? '' : 's'}!`);
    } else if (action === 'stop') {
      // Para lembretes: remove da fila, mantém tarefa ativa (não concluída)
      delete triggeredAlarmsRef.current[ringingTask.id];
      if (ringingTask.repeatEveryMin && ringingTask.repeatEveryMin > 0) {
        repeatAlarmsCache.current.delete(ringingTask.id);
        void cancelNativeAlarm(ringingTask.id);
      }
      showToast('Lembretes desativados. Tarefa permanece ativa.');
    }
  };

  // Share target Android: consome texto compartilhado de outro app na
  // abertura e toda vez que o app volta do fundo (ex.: via gaveta do Android).
  useEffect(() => {
    let cancelled = false;
    const check = () => { if (!cancelled) void consumeSharedText(); };
    check();
    let handle: { remove: () => void } | undefined;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) check(); })
      .then((h) => {
        if (cancelled) h.remove();
        else handle = h;
      })
      .catch(() => {});
    return () => { cancelled = true; handle?.remove(); };
  }, [consumeSharedText]);

  // Keyboard shortcut Ctrl+K / Cmd+K for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSearchModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearchModal]);

  const safeNotesList = Array.isArray(notes) ? notes : [];
  // Tipos eliminados do projeto: telas e contadores enxergam só DOCUMENTO.
  const visibleDocs = (Array.isArray(documents) ? documents : []).filter((d) => d && d.type === 'DOCUMENTO');
  const activeNoteForEditor = safeNotesList.find((n) => n && n.id === activeEditorNoteId);
  const isNative = Capacitor.isNativePlatform();

  return (
    <div
      className={`flex flex-col ${isNative ? 'justify-start p-0 h-[var(--app-h,100dvh)] overflow-hidden fixed inset-0' : 'items-center justify-center p-0 sm:p-4 md:p-6 min-h-screen'} transition-colors duration-300 ${
        isLightTheme ? 'bg-[#EDE7E1]' : 'bg-[#0E0A09]'
      }`}
    >
      {/* Alternância rápida de emulador para desktop */}
      {!isNative && (
        <div className="mb-2 hidden sm:flex items-center gap-3 text-xs text-zinc-400">
          <button
            onClick={() => setIsFullScreenPhone(!isFullScreenPhone)}
            className="px-3 py-1 bg-black/40 hover:bg-black/60 text-zinc-300 rounded-full border border-white/10 transition-all font-medium"
          >
            {isFullScreenPhone ? '📱 Modo Celular (390px)' : '🖥️ Modo Tela Cheia'}
          </button>
        </div>
      )}

      {/* Contêiner Emulador Android / Tela Cheia */}
      <div
        id="emulator-phone"
        className={isNative
          ? `relative w-full h-[var(--app-h,100dvh)] bg-jaspe-bg overflow-hidden flex flex-col select-none${isLightTheme ? ' light-theme' : ''}`
          : `relative w-full ${
          isFullScreenPhone
            ? 'max-w-2xl h-[94vh] rounded-3xl'
            : 'max-w-[390px] h-[844px] rounded-[48px]'
        } bg-jaspe-bg overflow-hidden border-8 border-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col select-none transition-all duration-300 ${
          isLightTheme ? 'light-theme' : ''
        }`}
      >
        {!isNative && <StatusBar />}

        <Header
          currentTab={currentTab}
          onToggleDrawer={() => {
            playSynthSound('click');
            openDrawer();
          }}
          onOpenSearch={() => {
            playSynthSound('click');
            openSearchModal();
          }}
          onOpenProfile={() => {
            playSynthSound('click');
            openProfileModal();
          }}
          profile={profile}
        />

        {/* Conteúdo Principal com ErrorBoundary */}
        <main className="flex-1 overflow-y-auto relative bg-jaspe-bg" id="app-content-scroll">
          <ErrorBoundary key={currentTab} tab={currentTab}>
            {currentTab === 'dashboard' && (
              <DashboardView
                onNavigate={selectTab}
                tasks={tasks}
                notesCount={Array.isArray(notes) ? notes.length : 0}
                contactsCount={Array.isArray(contacts) ? contacts.length : 0}
                userName={profile?.name || 'Orlando'}
                onShowToast={showToast}
                assets={assets}
                proventos={proventos}
                onToggleTask={toggleTask}
                onOpenTaskModal={(id) => openTaskDrawer(id)}
                onSaveScratchpadAsNote={saveScratchpadAsNote}
                onTriggerConfetti={triggerConfetti}
                onSaveTask={saveTask}
                onSaveContact={saveContact}
              />
            )}

            {currentTab === 'anotacoes' && (
              <NotesView
                notes={notes}
                onOpenEditor={(id) => setActiveEditorNoteId(id)}
                onCreateNewNote={createNewNote}
                onTogglePin={togglePinNote}
                onShowToast={showToast}
                onMigrateCategory={migrateNoteCategory}
              />
            )}

            {currentTab === 'contatos' && (
              <ContactsView
                contacts={contacts}
                onOpenEditModal={(id) => openContactModal(id)}
                onToggleFavorite={toggleFavoriteContact}
                onOpenMessageModal={(channel = 'whatsapp') => openMessageModal(channel)}
              />
            )}

            {currentTab === 'cofre' && (
              <CofreView
                credentials={credentials}
                isUnlocked={isCofreUnlocked}
                hasPinSetup={hasPinSetup}
                onSetupPin={setupPin}
                onUnlock={unlockVault}
                onVerifyPin={verifyCurrentPin}
                onChangePin={changePin}
                failedAttempts={failedAttempts}
                lockoutUntil={lockoutUntil}
                onLock={() => {
                  const msg = lockVault();
                  if (msg) showToast(msg);
                }}
                onOpenEditModal={(id) => openCredentialModal(id)}
                onShowToast={showToast}
              />
            )}

            {currentTab === 'carteira' && (
              <CarteiraView
                assets={assets}
                proventos={proventos}
                onOpenEditAssetModal={(id) => openAssetModal(id)}
                onOpenPDFImportModal={() => openPDFImportModal()}
                onTriggerYahooSync={triggerYahooSync}
                onShowToast={showToast}
                isYahooSyncing={isYahooSyncing}
                lastSyncInfo={lastSyncInfo}
                onDeleteAsset={deleteAsset}
                onOpenProfile={() => {
                  playSynthSound('click');
                  openProfileModal();
                }}
              />
            )}

            {currentTab === 'tarefas' && (
              <TasksView
                tasks={tasks}
                onOpenEditDrawer={(id) => openTaskDrawer(id)}
                onToggleTask={toggleTask}
                onMoveTaskStatus={moveTaskStatus}
              />
            )}

            {currentTab === 'office' && (
              <OfficeStudioView
                documents={visibleDocs}
                onOpenDoc={openDoc}
                onCreateDoc={createDoc}
                onCreateDocWith={createDocWith}
                onDeleteDoc={deleteDoc}
                onUnlinkDoc={unlinkDoc}
                isCreating={isDocCreateOpen}
                onOpenCreate={openDocCreate}
                onCloseCreate={closeDocCreate}
              />
            )}
          </ErrorBoundary>
        </main>

        <FooterNav currentTab={currentTab} onSelectTab={selectTab} />

        <FABRadial onAction={handleFABAction} />

        {/* Drawer Lateral */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => {
            playSynthSound('click');
            closeDrawer();
          }}
          onSelectTab={selectTab}
          currentTab={currentTab}
          pinnedNotesCount={(Array.isArray(notes) ? notes : []).filter((n) => n && n.pinned).length}
          contactsCount={Array.isArray(contacts) ? contacts.length : 0}
          isCofreUnlocked={isCofreUnlocked}
          assetsCount={Array.isArray(assets) ? assets.length : 0}
          documentsCount={visibleDocs.length}
          pendingTasksCount={(Array.isArray(tasks) ? tasks : []).filter((t) => t && !t.done).length}
          isLightTheme={isLightTheme}
          onToggleTheme={toggleTheme}
          onOpenReport={() => {
            closeDrawer();
            openReportModal();
          }}
          onOpenBackup={() => {
            closeDrawer();
            openBackupModal();
          }}
          trashCount={Array.isArray(trashItems) ? trashItems.length : 0}
          onOpenTrash={() => {
            closeDrawer();
            openTrashModal();
          }}
          onOpenProfile={() => {
            closeDrawer();
            openProfileModal();
          }}
          profile={profile}
        />

        {/* Editores e Modais envolvidos com ErrorBoundary */}
        <ErrorBoundary tab="modals">
          {activeOfficeDocId !== null &&
            (() => {
              const d = (Array.isArray(documents) ? documents : []).find((x) => x && x.id === activeOfficeDocId);
              if (!d) return null;
              return (
                <OfficeDocEditor
                  doc={d}
                  onSave={(patch) => saveOfficeDoc(d.id, patch)}
                  onClose={() => setActiveOfficeDocId(null)}
                  onDelete={deleteDoc}
                  onShowToast={showToast}
                  startEditing={docEditorStartsEditing}
                />
              );
            })()}

          {activeEditorNoteId !== null && activeNoteForEditor && (
            <OneNoteEditor
              note={activeNoteForEditor}
              onSave={saveActiveNote}
              onClose={() => setActiveEditorNoteId(null)}
              onDelete={deleteNote}
              onScheduleNote={scheduleNote}
              onShowToast={showToast}
            />
          )}

          <EditContactModal
            contactId={activeContactModalId}
            contacts={contacts}
            isOpen={isContactModalOpen}
            onClose={closeContactModal}
            onSave={saveContact}
            onDelete={deleteContact}
          />

          <EditCredentialModal
            credentialId={activeCredentialModalId}
            credentials={credentials}
            isOpen={isCredentialModalOpen}
            onClose={closeCredentialModal}
            onSave={saveCredential}
            onDelete={deleteCredential}
            onShowToast={showToast}
          />

          <EditAssetModal
            assetId={activeAssetModalId}
            assets={assets}
            isOpen={isAssetModalOpen}
            onClose={closeAssetModal}
            onSave={saveAsset}
            onDelete={deleteAsset}
          />

          <PDFImportModal
            isOpen={isPDFImportModalOpen}
            onClose={closePDFImportModal}
            onApproveAsset={(asset) => {
              saveAsset(asset);
              triggerConfetti();
            }}
            onShowToast={showToast}
          />

          <EditTaskDrawer
            taskId={activeTaskId}
            tasks={tasks}
            isOpen={isTaskDrawerOpen}
            isLightTheme={isLightTheme}
            onClose={closeTaskDrawer}
            onSave={saveTask}
            onDelete={deleteTask}
            onShowToast={showToast}
          />

          <TrashModal
            isOpen={isTrashOpen}
            onClose={closeTrashModal}
            items={trashItems}
            onRestore={restoreTrashItem}
            onDeleteForever={deleteTrashItem}
            onEmpty={emptyTrash}
          />

          <GlobalModals
            isSearchOpen={isSearchModalOpen}
            onCloseSearch={closeSearchModal}
            notes={notes}
            tasks={tasks}
            contacts={contacts}
            assets={assets}
            proventos={proventos}
            documents={visibleDocs}
            onNavigateTab={selectTab}
            onSelectNote={(id) => setActiveEditorNoteId(id)}
            isMessageOpen={isMessageModalOpen}
            onCloseMessage={closeMessageModal}
            initialChannel={messageChannel}
            isBackupOpen={isBackupModalOpen}
            onCloseBackup={closeBackupModal}
            onExportJSON={exportJSON}
            onExportEncryptedJaspe={exportEncryptedJaspe}
            onImportBackupFile={importBackupFile}
            isCofreUnlocked={isCofreUnlocked}
            onUnlockVault={unlockVault}
            hasPinSetup={hasPinSetup}
            failedAttempts={failedAttempts}
            isProfileOpen={isProfileModalOpen}
            onCloseProfile={closeProfileModal}
            profile={profile}
            onSaveProfile={saveProfile}
            isReportOpen={isReportModalOpen}
            onCloseReport={closeReportModal}
            ringingTask={ringingTask}
            alarmQueueCount={alarmQueue.length}
            onDismissAlarm={handleDismissAlarm}
            onShowToast={showToast}
            onTriggerConfetti={triggerConfetti}
          />
        </ErrorBoundary>

        <Toast message={toastMessage} />
      </div>
    </div>
  );
}
