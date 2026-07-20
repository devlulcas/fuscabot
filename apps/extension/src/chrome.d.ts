declare namespace chrome {
  namespace runtime {
    const onInstalled: { addListener(callback: () => void): void };
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (value: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    function sendMessage(message: unknown): Promise<unknown>;
  }
  namespace contextMenus {
    type OnClickData = {
      menuItemId: string | number;
      selectionText?: string;
      linkUrl?: string;
    };
    const onClicked: {
      addListener(callback: (info: OnClickData, tab?: tabs.Tab) => void): void;
    };
    function create(
      options: { id: string; title: string; contexts: string[] },
    ): void;
    function removeAll(): Promise<void>;
  }
  namespace tabs {
    type Tab = { id?: number; url?: string; title?: string; windowId?: number };
    function query(
      options: { active: boolean; currentWindow: boolean },
    ): Promise<Tab[]>;
  }
  namespace action {
    const onClicked: { addListener(callback: (tab: tabs.Tab) => void): void };
  }
  namespace sidePanel {
    function open(options: { windowId: number }): Promise<void>;
    function setOptions(
      options: { path: string; enabled: boolean; tabId?: number },
    ): Promise<void>;
    function setPanelBehavior(
      options: { openPanelOnActionClick: boolean },
    ): Promise<void>;
  }
  namespace scripting {
    function executeScript<T>(
      options: { target: { tabId: number }; func: () => T },
    ): Promise<Array<{ result: T }>>;
  }
  namespace storage.local {
    function get(keys?: string | string[]): Promise<Record<string, unknown>>;
    function set(items: Record<string, unknown>): Promise<void>;
  }
}
