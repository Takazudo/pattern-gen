import { useState, useRef, useCallback } from 'react';
import { GlobalHeader } from './global-header.js';
import { TabBar } from './tab-bar.js';
import type { Tab } from './tab-bar.js';
import { UserPage } from './user-page.js';
import './app-shell.css';

export function AppShell() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'tab-1', name: 'Pattern 1' }]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [showUserPage, setShowUserPage] = useState(false);

  const tabCounterRef = useRef(1);

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
          <div
            key={tab.id}
            className="tab-content-wrapper"
            style={{ display: tab.id === activeTabId ? 'contents' : 'none' }}
          >
            {/* TODO: wire TabContent after merge */}
            <div className="app" data-tab-id={tab.id} />
          </div>
        ))}
      </div>
      {showUserPage && (
        <UserPage
          onClose={() => setShowUserPage(false)}
          onLoadComposition={() => {}}
          onUseAsLayer={() => {}}
        />
      )}
    </div>
  );
}
