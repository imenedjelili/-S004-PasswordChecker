// Browser API Compatibility Layer
const browserAPI = {
    api: null,
    
    // Initialize the appropriate browser API
    init() {
        if (typeof chrome !== 'undefined') {
            if (typeof browser !== 'undefined') {
                // Firefox
                this.api = browser;
                this.browserType = 'firefox';
            } else {
                // Chrome, Edge, Opera
                this.api = chrome;
                this.browserType = 'chrome';
            }
        } else if (typeof browser !== 'undefined') {
            // Firefox fallback
            this.api = browser;
            this.browserType = 'firefox';
        } else if (typeof safari !== 'undefined') {
            // Safari
            this.api = safari;
            this.browserType = 'safari';
        }
    },

    // Runtime messaging
    async sendMessage(message) {
        if (this.browserType === 'firefox') {
            return await this.api.runtime.sendMessage(message);
        } else if (this.browserType === 'safari') {
            return new Promise((resolve) => {
                this.api.extension.dispatchMessage(message.action, message);
                // Safari doesn't support return values directly
                // Use a callback system for responses
                window.addEventListener('message', function(event) {
                    if (event.data.response && event.data.originalAction === message.action) {
                        resolve(event.data.response);
                    }
                });
            });
        } else {
            return new Promise((resolve) => {
                this.api.runtime.sendMessage(message, resolve);
            });
        }
    },

    // Storage operations
    storage: {
        async get(keys) {
            if (browserAPI.browserType === 'firefox') {
                return await browserAPI.api.storage.local.get(keys);
            } else if (browserAPI.browserType === 'safari') {
                const result = {};
                keys.forEach(key => {
                    result[key] = safari.extension.settings[key];
                });
                return result;
            } else {
                return new Promise((resolve) => {
                    browserAPI.api.storage.local.get(keys, resolve);
                });
            }
        },

        async set(items) {
            if (browserAPI.browserType === 'firefox') {
                return await browserAPI.api.storage.local.set(items);
            } else if (browserAPI.browserType === 'safari') {
                Object.entries(items).forEach(([key, value]) => {
                    safari.extension.settings[key] = value;
                });
                return;
            } else {
                return new Promise((resolve) => {
                    browserAPI.api.storage.local.set(items, resolve);
                });
            }
        }
    },

    // Notifications
    notifications: {
        create(options) {
            if (browserAPI.browserType === 'firefox') {
                return browserAPI.api.notifications.create(options);
            } else if (browserAPI.browserType === 'safari') {
                // Safari doesn't support native notifications through extension API
                // Fallback to web notifications
                if (Notification.permission === 'granted') {
                    return new Notification(options.title, {
                        body: options.message,
                        icon: options.iconUrl
                    });
                } else {
                    Notification.requestPermission();
                }
            } else {
                return browserAPI.api.notifications.create(options);
            }
        }
    },

    // Tabs operations
    tabs: {
        async sendMessage(tabId, message) {
            if (browserAPI.browserType === 'firefox') {
                return await browserAPI.api.tabs.sendMessage(tabId, message);
            } else if (browserAPI.browserType === 'safari') {
                // Safari handles this differently through content scripts
                safari.extension.dispatchMessage(message.action, {
                    target: 'tab',
                    tabId: tabId,
                    ...message
                });
            } else {
                return new Promise((resolve) => {
                    browserAPI.api.tabs.sendMessage(tabId, message, resolve);
                });
            }
        },

        async query(queryInfo) {
            if (browserAPI.browserType === 'firefox') {
                return await browserAPI.api.tabs.query(queryInfo);
            } else if (browserAPI.browserType === 'safari') {
                // Safari has a different tab API
                const windows = safari.application.browserWindows;
                const tabs = [];
                for (let i = 0; i < windows.length; i++) {
                    const windowTabs = windows[i].tabs;
                    for (let j = 0; j < windowTabs.length; j++) {
                        if (queryInfo.active && windowTabs[j] === safari.application.activeBrowserWindow.activeTab) {
                            tabs.push(windowTabs[j]);
                        }
                    }
                }
                return tabs;
            } else {
                return new Promise((resolve) => {
                    browserAPI.api.tabs.query(queryInfo, resolve);
                });
            }
        }
    },

    // Extension specific operations
    extension: {
        getURL(path) {
            if (browserAPI.browserType === 'firefox') {
                return browserAPI.api.extension.getURL(path);
            } else if (browserAPI.browserType === 'safari') {
                return safari.extension.baseURI + path;
            } else {
                return browserAPI.api.runtime.getURL(path);
            }
        }
    }
};

// Initialize the browser API
browserAPI.init();

// Export the API
window.browserAPI = browserAPI; 