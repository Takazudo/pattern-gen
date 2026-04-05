import { useState, useRef, useCallback } from 'react';
import { GlobalHeader } from './global-header.js';
import { TabBar } from './tab-bar.js';
import type { Tab } from './tab-bar.js';
import { TabContent } from './tab-content.js';
import type { TabContentHandle } from './tab-content.js';
import { UserPage } from './user-page.js';
import './app-shell.css';

export function AppShell() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'tab-1', name: 'Pattern 1' }]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [showUserPage, setShowUserPage] = useState(false);

  const tabCounterRef = useRef(1);
  const tabRefsMap = useRef<Map<string, TabContentHandle>>(new Map());

  const handleAddTab = useCallback(() => {
    tabCounterRef.current++;
    const newTab = { id: `tab-${Date.now()}`, name: `Pattern ${tabCounterRef.current}` };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        tabRefsMap.current.delete(tabId);
        return next;
      });
    },
    [activeTabId],
  );

  const handleSwitchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleRenameTab = useCallback((tabId: string, newName: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name: newName } : t)));
  }, []);

  const setTabRef = useCallback((tabId: string) => (handle: TabContentHandle | null) => {
    if (handle) {
      tabRefsMap.current.set(tabId, handle);
    } else {
      tabRefsMap.current.delete(tabId);
    }
  }, []);

  return (
    <div className="app-shell">
      <GlobalHeader onOpenUserPage={() => setShowUserPage(true)} />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitch={handleSwitchTab}
        onClose={handleCloseTab}
        onAdd={handleAddTab}
        onRename={handleRenameTab}
      />
      <div className="app-shell-content">
        {tabs.map((tab) => (
          <TabContent
            key={tab.id}
            ref={setTabRef(tab.id)}
            tabId={tab.id}
            isActive={tab.id === activeTabId}
          />
        ))}
      </div>
      {showUserPage && (
        <UserPage
          onClose={() => setShowUserPage(false)}
          onLoadComposition={(comp) => tabRefsMap.current.get(activeTabId)?.loadComposition(comp)}
          onUseAsLayer={(file) => tabRefsMap.current.get(activeTabId)?.importImageAsLayer(file)}
        />
      )}
    </div>
  );
}
