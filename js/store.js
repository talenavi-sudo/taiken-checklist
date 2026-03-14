/* ========================================
   Store - データ管理
   Phase 1: localStorage ベース
   Phase 2: Cloudflare KV API に差し替え予定
   ======================================== */

const Store = {
  // ---------- チェックリストテンプレート ----------
  // 体験種類ごとのチェック項目マスタ

  getChecklistTypes() {
    const data = localStorage.getItem('cl_types');
    if (data) return JSON.parse(data);
    // デフォルトデータ（初回用）
    const defaults = [
      {
        id: 'type_1',
        name: '藍染体験',
        icon: '染',
        color: 'blue',
        items: [
          { id: 'i1', name: '染料の準備（藍液チェック）', category: 'prep', order: 1 },
          { id: 'i2', name: '作業台に養生シートを敷く', category: 'prep', order: 2 },
          { id: 'i3', name: 'ゴム手袋・エプロンを人数分用意', category: 'prep', order: 3 },
          { id: 'i4', name: '白布を水洗い・干す', category: 'cleanup', order: 4 },
          { id: 'i5', name: '染料容器の蓋を閉じ保管', category: 'cleanup', order: 5 },
        ]
      },
      {
        id: 'type_2',
        name: '陶芸体験',
        icon: '陶',
        color: 'coral',
        items: [
          { id: 'i6', name: 'ろくろの動作確認', category: 'prep', order: 1 },
          { id: 'i7', name: '粘土を人数分計量', category: 'prep', order: 2 },
          { id: 'i8', name: '道具セット（ヘラ・針・切り糸）配置', category: 'prep', order: 3 },
          { id: 'i9', name: 'エプロン・タオル準備', category: 'prep', order: 4 },
          { id: 'i10', name: 'ろくろ清掃・電源OFF', category: 'cleanup', order: 5 },
          { id: 'i11', name: '余った粘土を密封保管', category: 'cleanup', order: 6 },
          { id: 'i12', name: '作品を乾燥棚に移動', category: 'cleanup', order: 7 },
        ]
      },
      {
        id: 'type_3',
        name: '木工体験',
        icon: '木',
        color: 'green',
        items: [
          { id: 'i13', name: '工具の点検・配置', category: 'prep', order: 1 },
          { id: 'i14', name: '木材キットを人数分準備', category: 'prep', order: 2 },
          { id: 'i15', name: 'サンドペーパー・接着剤セット', category: 'prep', order: 3 },
          { id: 'i16', name: '木くず・おがくずの清掃', category: 'cleanup', order: 4 },
          { id: 'i17', name: '工具を元の位置に返却', category: 'cleanup', order: 5 },
          { id: 'i18', name: '換気扇OFF・施錠確認', category: 'cleanup', order: 6 },
        ]
      }
    ];
    this.saveChecklistTypes(defaults);
    return defaults;
  },

  saveChecklistTypes(types) {
    localStorage.setItem('cl_types', JSON.stringify(types));
  },

  addChecklistType(type) {
    const types = this.getChecklistTypes();
    type.id = 'type_' + Date.now();
    type.items = [];
    types.push(type);
    this.saveChecklistTypes(types);
    return type;
  },

  deleteChecklistType(typeId) {
    let types = this.getChecklistTypes();
    types = types.filter(t => t.id !== typeId);
    this.saveChecklistTypes(types);
  },

  addChecklistItem(typeId, item) {
    const types = this.getChecklistTypes();
    const type = types.find(t => t.id === typeId);
    if (!type) return null;
    item.id = 'i_' + Date.now();
    item.order = type.items.length + 1;
    type.items.push(item);
    this.saveChecklistTypes(types);
    return item;
  },

  deleteChecklistItem(typeId, itemId) {
    const types = this.getChecklistTypes();
    const type = types.find(t => t.id === typeId);
    if (!type) return;
    type.items = type.items.filter(i => i.id !== itemId);
    type.items.forEach((item, idx) => item.order = idx + 1);
    this.saveChecklistTypes(types);
  },

  // ---------- 予約（イベント）管理 ----------
  // Google Calendar API から取得。失敗時はキャッシュを返す。

  getBookings() {
    const data = localStorage.getItem('bookings');
    return data ? JSON.parse(data) : [];
  },

  saveBookings(bookings) {
    localStorage.setItem('bookings', JSON.stringify(bookings));
  },

  async fetchBookingsFromAPI() {
    try {
      const res = await fetch('/api/calendar');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (data.success && data.bookings) {
        this.saveBookings(data.bookings);
        return data.bookings;
      }
      throw new Error(data.error || 'Unknown error');
    } catch (err) {
      console.warn('カレンダー取得失敗、キャッシュを使用:', err.message);
      return this.getBookings();
    }
  },

  // ---------- 予約×チェックリスト状態 ----------
  // bookingId → { typeId, checkedItems: [itemId, ...], completedAt }

  getBookingStatus(bookingId) {
    const all = this._getAllStatuses();
    return all[bookingId] || null;
  },

  setBookingType(bookingId, typeId) {
    const all = this._getAllStatuses();
    all[bookingId] = {
      typeId,
      checkedItems: [],
      completedAt: null,
    };
    this._saveAllStatuses(all);
  },

  toggleCheckItem(bookingId, itemId) {
    const all = this._getAllStatuses();
    const status = all[bookingId];
    if (!status) return null;
    const idx = status.checkedItems.indexOf(itemId);
    if (idx >= 0) {
      status.checkedItems.splice(idx, 1);
      status.completedAt = null;
    } else {
      status.checkedItems.push(itemId);
    }
    this._saveAllStatuses(all);
    return status;
  },

  markComplete(bookingId) {
    const all = this._getAllStatuses();
    const status = all[bookingId];
    if (!status) return;
    status.completedAt = new Date().toISOString();
    this._saveAllStatuses(all);
  },

  _getAllStatuses() {
    const data = localStorage.getItem('booking_statuses');
    return data ? JSON.parse(data) : {};
  },

  _saveAllStatuses(statuses) {
    localStorage.setItem('booking_statuses', JSON.stringify(statuses));
  },

  // ---------- ユーティリティ ----------

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
};
