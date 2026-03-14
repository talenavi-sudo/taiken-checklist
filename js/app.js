/* ========================================
   App - メインUI制御
   ======================================== */

const App = {
  currentScreen: 'bookings',
  currentBookingId: null,
  selectedTypeId: null,
  editingTypeId: null,
  editingItemId: null,

  init() {
    this.renderDate();
    this.bindTabs();
    this.bindNavigation();
    this.bindModals();
    this.renderBookings();
    this.renderAdmin();
    // APIからカレンダーデータを取得（バックグラウンド）
    this.refreshBookings();
  },

  async refreshBookings() {
    const bookings = await Store.fetchBookingsFromAPI();
    if (bookings.length > 0) {
      this.renderBookings();
    }
  },

  // ---------- 日付表示 ----------
  renderDate() {
    const d = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    document.getElementById('today-date').textContent =
      `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  },

  // ---------- タブ切り替え ----------
  bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.showScreen(target === 'admin' ? 'admin' : 'bookings');
      });
    });
  },

  showScreen(name) {
    this.currentScreen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screenId = 'screen-' + name;
    const el = document.getElementById(screenId);
    if (el) el.classList.add('active');

    // タブの同期
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (name === 'admin') {
      document.querySelector('[data-tab="admin"]').classList.add('active');
    } else {
      document.querySelector('[data-tab="bookings"]').classList.add('active');
    }
  },

  // ---------- ナビゲーション ----------
  bindNavigation() {
    document.getElementById('back-to-bookings').addEventListener('click', () => {
      this.showScreen('bookings');
    });
    document.getElementById('back-to-select').addEventListener('click', () => {
      this.showScreen('select');
    });
    document.getElementById('start-checklist-btn').addEventListener('click', () => {
      this.startChecklist();
    });
    document.getElementById('complete-btn').addEventListener('click', () => {
      this.completeChecklist();
    });
  },

  // ---------- 予約一覧 ----------
  renderBookings() {
    const bookings = Store.getBookings();
    const types = Store.getChecklistTypes();
    const container = document.getElementById('bookings-list');

    // 日付でグループ化
    const groups = {};
    bookings.forEach(b => {
      const date = new Date(b.startTime).toLocaleDateString('ja-JP');
      if (!groups[date]) groups[date] = [];
      groups[date].push(b);
    });

    const today = new Date().toLocaleDateString('ja-JP');
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('ja-JP');

    let html = '';
    Object.entries(groups).forEach(([date, items]) => {
      let label = date;
      if (date === today) label = `本日の予約 (${items.length}件)`;
      else if (date === tomorrow) label = `明日の予約 (${items.length}件)`;

      html += `<p class="day-label">${label}</p>`;
      items.forEach(b => {
        const status = Store.getBookingStatus(b.id);
        const badge = this.getStatusBadge(b.id, status, types);
        const detail = this.getBookingDetail(status, types, b);
        const start = this.formatTime(b.startTime);
        const end = this.formatTime(b.endTime);
        const isFuture = date !== today;

        html += `
          <div class="booking-card" 
               onclick="App.openBooking('${b.id}')" 
               style="${isFuture ? 'opacity:0.6' : ''}">
            <div class="booking-time-block">
              <span class="booking-time-start">${start}</span>
              <span class="booking-time-end">${end}</span>
            </div>
            <div class="booking-separator"></div>
            <div class="booking-content">
              <div class="booking-title">${this.escHtml(b.displayName)}</div>
              <div class="booking-footer">
                ${badge}
                <span class="booking-detail">${detail}</span>
              </div>
            </div>
          </div>`;
      });
    });

    if (bookings.length === 0) {
      html = `
        <div class="empty-state">
          <div class="empty-state-text">予約がありません<br>Googleカレンダーと連携すると<br>ここに予約が表示されます</div>
        </div>`;
    }

    container.innerHTML = html;
  },

  getStatusBadge(bookingId, status, types) {
    if (!status) {
      return '<span class="badge badge-pending">未選択</span>';
    }
    const type = types.find(t => t.id === status.typeId);
    if (!type) return '<span class="badge badge-none">-</span>';

    if (status.completedAt) {
      return '<span class="badge badge-done">完了</span>';
    }

    const total = type.items.length;
    const checked = status.checkedItems.length;
    if (checked === 0) {
      return '<span class="badge badge-progress">準備前</span>';
    }
    return `<span class="badge badge-progress">${checked}/${total}</span>`;
  },

  getBookingDetail(status, types, booking) {
    if (!status) return 'チェックリスト未選択';
    const type = types.find(t => t.id === status.typeId);
    if (!type) return '';
    return `${type.name} / ${booking.guestCount}名`;
  },

  // ---------- 予約を開く → チェックリスト選択 ----------
  openBooking(bookingId) {
    this.currentBookingId = bookingId;
    this.selectedTypeId = null;

    const bookings = Store.getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const status = Store.getBookingStatus(bookingId);

    // 既にチェックリストが選択済みなら、直接チェックリスト画面へ
    if (status && status.typeId) {
      this.selectedTypeId = status.typeId;
      this.renderChecklist();
      this.showScreen('checklist');
      return;
    }

    // 選択画面を表示
    document.getElementById('select-time').textContent =
      `${this.formatTime(booking.startTime)} - ${this.formatTime(booking.endTime)}`;
    document.getElementById('select-title').textContent = booking.displayName;
    document.getElementById('select-meta').textContent =
      `${this.formatTime(booking.startTime)} - ${this.formatTime(booking.endTime)} / ${booking.guestCount}名`;
    document.getElementById('select-cal').textContent =
      `カレンダー: 「${booking.calendarTitle}」`;

    this.renderChecklistOptions();
    this.showScreen('select');
  },

  renderChecklistOptions() {
    const types = Store.getChecklistTypes();
    const container = document.getElementById('checklist-options');

    let html = '';
    types.forEach(type => {
      const prepCount = type.items.filter(i => i.category === 'prep').length;
      const cleanupCount = type.items.filter(i => i.category === 'cleanup').length;
      html += `
        <div class="cl-option" onclick="App.selectType('${type.id}')" data-type-id="${type.id}">
          <div class="cl-option-icon theme-${type.color}">${this.escHtml(type.icon)}</div>
          <div class="cl-option-info">
            <div class="cl-option-name">${this.escHtml(type.name)}</div>
            <div class="cl-option-count">準備${prepCount} + 片付け${cleanupCount} = ${type.items.length}項目</div>
          </div>
          <div class="cl-radio"></div>
        </div>`;
    });

    if (types.length === 0) {
      html = `<div class="empty-state"><div class="empty-state-text">管理画面で体験種類を追加してください</div></div>`;
    }

    container.innerHTML = html;

    // ボタンリセット
    const btn = document.getElementById('start-checklist-btn');
    btn.className = 'action-btn disabled';
    btn.disabled = true;
    btn.textContent = 'チェックリストを選んでください';
  },

  selectType(typeId) {
    this.selectedTypeId = typeId;
    const types = Store.getChecklistTypes();
    const type = types.find(t => t.id === typeId);

    // UI更新
    document.querySelectorAll('.cl-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.typeId === typeId);
    });

    const btn = document.getElementById('start-checklist-btn');
    btn.className = 'action-btn ready';
    btn.disabled = false;
    btn.textContent = `${type.name} のチェックリストを開始`;
  },

  startChecklist() {
    if (!this.selectedTypeId || !this.currentBookingId) return;

    // ステータスを保存
    Store.setBookingType(this.currentBookingId, this.selectedTypeId);
    this.renderChecklist();
    this.showScreen('checklist');
    this.renderBookings(); // 一覧のバッジ更新
  },

  // ---------- チェックリスト実行 ----------
  renderChecklist() {
    const bookings = Store.getBookings();
    const booking = bookings.find(b => b.id === this.currentBookingId);
    const types = Store.getChecklistTypes();
    const type = types.find(t => t.id === this.selectedTypeId);
    const status = Store.getBookingStatus(this.currentBookingId);

    if (!booking || !type || !status) return;

    document.getElementById('cl-time').textContent =
      `${this.formatTime(booking.startTime)} - ${this.formatTime(booking.endTime)}`;
    document.getElementById('cl-event-name').textContent = booking.displayName;
    document.getElementById('cl-type-name').textContent = type.name;

    // アイテム描画
    const prepItems = type.items.filter(i => i.category === 'prep').sort((a, b) => a.order - b.order);
    const cleanupItems = type.items.filter(i => i.category === 'cleanup').sort((a, b) => a.order - b.order);

    let html = '';
    let orderNum = 1;

    if (prepItems.length > 0) {
      html += '<div class="cl-category"><div class="cl-category-label">事前準備</div>';
      prepItems.forEach(item => {
        const checked = status.checkedItems.includes(item.id);
        html += this.renderCheckItem(item, orderNum++, checked);
      });
      html += '</div>';
    }

    if (cleanupItems.length > 0) {
      html += '<div class="cl-category"><div class="cl-category-label">片付け</div>';
      cleanupItems.forEach(item => {
        const checked = status.checkedItems.includes(item.id);
        html += this.renderCheckItem(item, orderNum++, checked);
      });
      html += '</div>';
    }

    document.getElementById('checklist-items').innerHTML = html;
    this.updateProgress();
  },

  renderCheckItem(item, order, checked) {
    return `
      <div class="cl-item${checked ? ' checked' : ''}" 
           onclick="App.toggleItem('${item.id}')" 
           data-item-id="${item.id}">
        <span class="cl-item-order">${order}</span>
        <div class="cl-checkbox"></div>
        <span class="cl-item-label">${this.escHtml(item.name)}</span>
      </div>`;
  },

  toggleItem(itemId) {
    if (!this.currentBookingId) return;
    Store.toggleCheckItem(this.currentBookingId, itemId);

    // DOM直接更新（再描画なし）
    const el = document.querySelector(`[data-item-id="${itemId}"]`);
    if (el) el.classList.toggle('checked');

    this.updateProgress();
  },

  updateProgress() {
    const types = Store.getChecklistTypes();
    const type = types.find(t => t.id === this.selectedTypeId);
    const status = Store.getBookingStatus(this.currentBookingId);
    if (!type || !status) return;

    const total = type.items.length;
    const checked = status.checkedItems.length;
    const pct = total > 0 ? (checked / total * 100) : 0;

    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${checked}/${total}`;

    const btn = document.getElementById('complete-btn');
    if (checked === total && total > 0) {
      btn.className = 'action-btn ready';
      btn.disabled = false;
      btn.textContent = '完了報告を送信';
    } else {
      btn.className = 'action-btn disabled';
      btn.disabled = true;
      btn.textContent = `全て完了するとOK送信できます`;
    }
  },

  completeChecklist() {
    if (!this.currentBookingId) return;
    Store.markComplete(this.currentBookingId);
    this.renderBookings();
    this.showToast('完了報告を送信しました！');
    this.showScreen('bookings');
  },

  // ---------- 管理画面 ----------
  renderAdmin() {
    const types = Store.getChecklistTypes();
    const container = document.getElementById('admin-list');

    let html = '';
    types.forEach(type => {
      const prepItems = type.items.filter(i => i.category === 'prep').sort((a, b) => a.order - b.order);
      const cleanupItems = type.items.filter(i => i.category === 'cleanup').sort((a, b) => a.order - b.order);
      const allItems = [...prepItems, ...cleanupItems];

      html += `
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title">
              <div class="admin-card-icon theme-${type.color}">${this.escHtml(type.icon)}</div>
              ${this.escHtml(type.name)}
            </div>
            <span class="admin-card-count">${type.items.length}項目</span>
          </div>
          <div class="admin-items">`;

      allItems.forEach(item => {
        const catLabel = item.category === 'prep' ? '準備' : '片付';
        html += `
            <div class="admin-item">
              <span class="admin-item-drag">::</span>
              <span class="admin-item-name">${this.escHtml(item.name)}</span>
              <span class="admin-item-cat">${catLabel}</span>
              <button class="admin-item-delete" onclick="App.deleteItem('${type.id}','${item.id}')" title="削除">×</button>
            </div>`;
      });

      html += `
          </div>
          <button class="admin-add-item" onclick="App.openAddItemModal('${type.id}')">
            + 項目を追加
          </button>
        </div>`;
    });

    container.innerHTML = html;
  },

  deleteItem(typeId, itemId) {
    if (!confirm('この項目を削除しますか？')) return;
    Store.deleteChecklistItem(typeId, itemId);
    this.renderAdmin();
    this.showToast('項目を削除しました');
  },

  // ---------- モーダル制御 ----------
  bindModals() {
    // アイテム追加モーダル
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-save').addEventListener('click', () => this.saveItem());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });

    // カテゴリトグル
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 体験種類追加モーダル
    document.getElementById('add-type-btn').addEventListener('click', () => this.openAddTypeModal());
    document.getElementById('modal-type-close').addEventListener('click', () => this.closeTypeModal());
    document.getElementById('modal-type-cancel').addEventListener('click', () => this.closeTypeModal());
    document.getElementById('modal-type-save').addEventListener('click', () => this.saveType());
    document.getElementById('modal-type-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeTypeModal();
    });

    // カラー選択
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  },

  openAddItemModal(typeId) {
    this.editingTypeId = typeId;
    this.editingItemId = null;
    document.getElementById('modal-title').textContent = '項目を追加';
    document.getElementById('modal-item-name').value = '';
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('cat-prep').classList.add('active');
    document.getElementById('modal-overlay').classList.add('visible');
    setTimeout(() => document.getElementById('modal-item-name').focus(), 200);
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('visible');
  },

  saveItem() {
    const name = document.getElementById('modal-item-name').value.trim();
    if (!name) {
      document.getElementById('modal-item-name').focus();
      return;
    }

    const category = document.querySelector('.toggle-btn.active').dataset.cat;
    Store.addChecklistItem(this.editingTypeId, { name, category });
    this.closeModal();
    this.renderAdmin();
    this.showToast('項目を追加しました');
  },

  openAddTypeModal() {
    document.getElementById('modal-type-name').value = '';
    document.getElementById('modal-type-icon').value = '';
    document.querySelectorAll('.color-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));
    document.getElementById('modal-type-overlay').classList.add('visible');
    setTimeout(() => document.getElementById('modal-type-name').focus(), 200);
  },

  closeTypeModal() {
    document.getElementById('modal-type-overlay').classList.remove('visible');
  },

  saveType() {
    const name = document.getElementById('modal-type-name').value.trim();
    const icon = document.getElementById('modal-type-icon').value.trim();
    if (!name || !icon) {
      if (!name) document.getElementById('modal-type-name').focus();
      else document.getElementById('modal-type-icon').focus();
      return;
    }

    const color = document.querySelector('.color-btn.selected').dataset.color;
    Store.addChecklistType({ name, icon, color });
    this.closeTypeModal();
    this.renderAdmin();
    this.showToast(`${name} を追加しました`);
  },

  // ---------- ユーティリティ ----------
  formatTime(isoStr) {
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  },

  escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  },
};

// 起動
document.addEventListener('DOMContentLoaded', () => App.init());
