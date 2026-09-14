// db-local.js — a tiny offline queue for symptom logs.
// Uses localStorage so it works with zero setup and survives page reloads.
// Each queued item is synced to the API the moment the browser reports "online".

const LocalQueue = {
  KEY: 'luhid_offline_queue_v1',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
  },

  push(item) {
    const items = this.getAll();
    items.push({ ...item, _queuedAt: Date.now(), _synced: false });
    this.save(items);
    return items;
  },

  markSynced(index) {
    const items = this.getAll();
    if (items[index]) items[index]._synced = true;
    this.save(items);
  },

  clearSynced() {
    const items = this.getAll().filter((i) => !i._synced);
    this.save(items);
  },

  async syncAll() {
    const items = this.getAll();
    for (let i = 0; i < items.length; i++) {
      if (items[i]._synced) continue;
      try {
        await Api.addLog(items[i].tagCode, {
          symptoms: items[i].symptoms,
          severity: items[i].severity,
          language: items[i].language,
          aiAdvice: items[i].aiAdvice,
          source: 'synced-offline'
        });
        this.markSynced(i);
      } catch (err) {
        console.warn('Sync failed for queued log, will retry later:', err.message);
      }
    }
    this.clearSynced();
  }
};

window.addEventListener('online', () => LocalQueue.syncAll());
