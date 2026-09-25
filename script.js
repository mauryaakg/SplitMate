const STORAGE_KEY = 'splitmate-local-v1';
const CATEGORY_ICONS = {
  Food: '🍽️',
  Rent: '🏠',
  Travel: '🚆',
  Shopping: '🛍️',
  Bills: '💡',
  Education: '📚',
  Entertainment: '🎬',
  Health: '💊',
  Other: '📌'
};

const defaultState = () => ({
  settings: {
    currency: 'INR',
    darkMode: false,
    currentUser: 'Akash',
    currentMonth: getCurrentMonthKey()
  },
  budgets: {},
  expenses: [],
  groups: [],
  sharedExpenses: [],
  settlements: []
});

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const getCurrentMonthKey = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const clampAmount = (value) => {
  const amount = safeNumber(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const generateId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const formatCurrency = (value) => {
  const amount = safeNumber(value);
  if (!Number.isFinite(amount)) return '₹0';
  return currencyFormatter.format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return fullDateFormatter.format(date);
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'Current Month';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return monthFormatter.format(date);
};

const getMonthOptions = () => {
  const now = new Date();
  const options = [];
  for (let i = -6; i <= 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = getCurrentMonthKey(date);
    options.push({ key, label: formatMonthLabel(key) });
  }
  return options;
};

const readData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      settings: { ...base.settings, ...(parsed.settings || {}) },
      budgets: parsed.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : {},
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      sharedExpenses: Array.isArray(parsed.sharedExpenses) ? parsed.sharedExpenses : [],
      settlements: Array.isArray(parsed.settlements) ? parsed.settlements : []
    };
  } catch (error) {
    console.warn('Failed to parse local storage.', error);
    return defaultState();
  }
};

const saveData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Could not write localStorage', error);
    return false;
  }
};

const showToast = (message) => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2200);
};

const setTheme = (darkMode) => {
  document.body.classList.toggle('dark', Boolean(darkMode));
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = darkMode ? '☀️' : '🌙';
  }
};

const getSelectedMonth = () => {
  const state = readData();
  return state.settings.currentMonth || getCurrentMonthKey();
};

const getExpensesForMonth = (expenses, monthKey) => {
  return expenses.filter((expense) => {
    const date = expense.date || '';
    return date.startsWith(monthKey);
  });
};

const getCurrentBudget = (state, monthKey) => {
  return clampAmount(state.budgets[monthKey] || 0);
};

const calculateBudgetStats = (state, monthKey) => {
  const expenses = getExpensesForMonth(state.expenses, monthKey);
  const totalSpent = expenses.reduce((sum, expense) => sum + clampAmount(expense.amount), 0);
  const budget = getCurrentBudget(state, monthKey);
  const remaining = budget - totalSpent;

  return {
    budget,
    totalSpent,
    remaining,
    expenseCount: expenses.length
  };
};

const getCategoryTotals = (expenses) => {
  return expenses.reduce((acc, expense) => {
    const category = expense.category || 'Other';
    acc[category] = (acc[category] || 0) + clampAmount(expense.amount);
    return acc;
  }, {});
};

const getSharedBalances = (sharedExpenses, groupId = null) => {
  const filtered = groupId
    ? sharedExpenses.filter((item) => item.groupId === groupId)
    : sharedExpenses;

  const totals = {};
  filtered.forEach((expense) => {
    const participants = Array.isArray(expense.participants) && expense.participants.length
      ? expense.participants
      : [expense.paidBy];
    const cleanedParticipants = [...new Set(participants.filter(Boolean))];
    const share = clampAmount(expense.amount) / Math.max(cleanedParticipants.length, 1);

    cleanedParticipants.forEach((person) => {
      totals[person] = (totals[person] || 0) - share;
    });

    if (expense.paidBy) {
      totals[expense.paidBy] = (totals[expense.paidBy] || 0) + clampAmount(expense.amount);
    }
  });

  return totals;
};

const buildSuggestedSettlements = (balances) => {
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([person, amount]) => {
    if (amount > 0) {
      creditors.push({ person, amount });
    } else if (amount < 0) {
      debtors.push({ person, amount: Math.abs(amount) });
    }
  });

  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      settlements.push({
        from: debtor.person,
        to: creditor.person,
        amount
      });
      creditor.amount -= amount;
      debtor.amount -= amount;
    }

    if (creditor.amount <= 0.001) creditorIndex += 1;
    if (debtor.amount <= 0.001) debtorIndex += 1;
  }

  return settlements;
};

const getGroupSummary = (state, groupId) => {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return null;

  const members = [...new Set((group.members || []).filter(Boolean))];
  const expenses = state.sharedExpenses.filter((expense) => expense.groupId === groupId);
  const totals = members.reduce((acc, member) => {
    acc[member] = { paid: 0, share: 0, net: 0 };
    return acc;
  }, {});

  expenses.forEach((expense) => {
    const participants = Array.isArray(expense.participants) && expense.participants.length
      ? expense.participants
      : [expense.paidBy];
    const cleaned = [...new Set(participants.filter(Boolean))];
    const share = clampAmount(expense.amount) / Math.max(cleaned.length, 1);

    members.forEach((member) => {
      totals[member].share += cleaned.includes(member) ? share : 0;
    });

    if (expense.paidBy && totals[expense.paidBy]) {
      totals[expense.paidBy].paid += clampAmount(expense.amount);
    }
  });

  Object.keys(totals).forEach((member) => {
    totals[member].net = totals[member].paid - totals[member].share;
  });

  return {
    group,
    members,
    expenses,
    totals,
    totalSpent: expenses.reduce((sum, expense) => sum + clampAmount(expense.amount), 0),
    suggestions: buildSuggestedSettlements(
      Object.fromEntries(
        Object.entries(totals).map(([member, values]) => [member, values.net])
      )
    )
  };
};

const renderAppMonthOptions = () => {
  const monthSelector = document.getElementById('monthSelector');
  const expenseMonthFilter = document.getElementById('expenseMonthFilter');
  const state = readData();
  const options = getMonthOptions();

  const populate = (element) => {
    element.innerHTML = options
      .map(
        (option) =>
          `<option value="${option.key}">${option.label}</option>`
      )
      .join('');

    element.value = state.settings.currentMonth || getCurrentMonthKey();
  };

  populate(monthSelector);
  populate(expenseMonthFilter);
};

const renderDashboard = () => {
  const state = readData();
  const currentMonth = state.settings.currentMonth || getCurrentMonthKey();
  const stats = calculateBudgetStats(state, currentMonth);

  document.getElementById('monthSelector').value = currentMonth;
  document.getElementById('budgetAmountInput').value = stats.budget || '';
  document.getElementById('budgetValue').textContent = formatCurrency(stats.budget);
  document.getElementById('spentValue').textContent = formatCurrency(stats.totalSpent);
  document.getElementById('remainingValue').textContent = formatCurrency(stats.remaining);
  document.getElementById('expenseCountValue').textContent = String(stats.expenseCount);

  const sharedBalances = getSharedBalances(state.sharedExpenses);
  const user = state.settings.currentUser || 'Akash';
  const currentBalance = safeNumber(sharedBalances[user] || 0);

  const sharedBalanceEl = document.getElementById('sharedBalanceDisplay');
  const sharedBalanceHint = document.getElementById('sharedBalanceHint');

  if (Math.abs(currentBalance) < 0.001) {
    sharedBalanceEl.textContent = 'Settled';
    sharedBalanceEl.classList.remove('positive', 'negative');
    sharedBalanceHint.textContent = 'No outstanding split balance for your account.';
  } else if (currentBalance > 0) {
    sharedBalanceEl.textContent = `You are owed ${formatCurrency(currentBalance)}`;
    sharedBalanceEl.classList.remove('negative');
    sharedBalanceEl.classList.add('positive');
    sharedBalanceHint.textContent = `${user} is owed by others in the group balance.`;
  } else {
    sharedBalanceEl.textContent = `You owe ${formatCurrency(Math.abs(currentBalance))}`;
    sharedBalanceEl.classList.remove('positive');
    sharedBalanceEl.classList.add('negative');
    sharedBalanceHint.textContent = `${user} needs to settle with friends.`;
  }

  const recentExpenses = [...state.expenses]
    .filter((expense) => expense.date && expense.date.startsWith(currentMonth))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const recentList = document.getElementById('recentExpensesList');
  if (!recentExpenses.length) {
    recentList.innerHTML = '<li class="empty-state">No expenses yet for this month.</li>';
    return;
  }

  recentList.innerHTML = recentExpenses
    .map(
      (expense) => `
        <li class="mini-item">
          <div class="row-between">
            <strong>${escapeHtml(expense.name)}</strong>
            <span class="amount-pill">${formatCurrency(expense.amount)}</span>
          </div>
          <div class="expense-meta">
            <span>${expense.category}</span>
            <span>${formatDate(expense.date)}</span>
          </div>
        </li>
      `
    )
    .join('');
};

const renderExpenseList = () => {
  const state = readData();
  const searchTerm = document.getElementById('expenseSearch').value.trim().toLowerCase();
  const categoryFilter = document.getElementById('expenseCategoryFilter').value;
  const monthFilter = document.getElementById('expenseMonthFilter').value || getCurrentMonthKey();

  const filteredExpenses = [...state.expenses]
    .filter((expense) => expense.date && expense.date.startsWith(monthFilter))
    .filter((expense) =>
      (categoryFilter === 'All' || expense.category === categoryFilter) &&
      (!searchTerm || expense.name.toLowerCase().includes(searchTerm) || (expense.note || '').toLowerCase().includes(searchTerm))
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = document.getElementById('expenseList');
  if (!filteredExpenses.length) {
    list.innerHTML = '<div class="empty-state">No expenses yet. Add your first expense to start tracking.</div>';
    return;
  }

  list.innerHTML = filteredExpenses
    .map(
      (expense) => `
        <div class="expense-item">
          <div class="expense-item-top">
            <div class="expense-title">
              <span class="category-badge">${CATEGORY_ICONS[expense.category] || '📌'}</span>
              <div>
                <div>${escapeHtml(expense.name)}</div>
                <div class="expense-meta">
                  <span>${formatDate(expense.date)}</span>
                  <span>${expense.category}</span>
                </div>
              </div>
            </div>
            <span class="amount-pill">${formatCurrency(expense.amount)}</span>
          </div>

          ${expense.note ? `<div class="expense-meta"><span>${escapeHtml(expense.note)}</span></div>` : ''}

          <div class="expense-actions">
            <button class="action-button" data-action="edit-expense" data-id="${expense.id}" type="button">Edit</button>
            <button class="action-button delete" data-action="delete-expense" data-id="${expense.id}" type="button">Delete</button>
          </div>
        </div>
      `
    )
    .join('');
};

const renderSplitSummary = () => {
  const state = readData();
  const balances = getSharedBalances(state.sharedExpenses);
  const members = [...new Set(Object.keys(balances).concat(state.groups.flatMap((group) => group.members || []), state.settings.currentUser || 'Akash'))].filter(Boolean);

  const summary = document.getElementById('splitSummary');
  if (!members.length || Object.keys(balances).length === 0) {
    summary.innerHTML = '<div class="empty-state">No shared expenses yet. Split your first expense with friends.</div>';
    return;
  }

  const items = members
    .map((member) => {
      const amount = safeNumber(balances[member] || 0);
      if (Math.abs(amount) < 0.001) return '';

      if (amount > 0) {
        return `
          <div class="balance-item">
            <strong>${escapeHtml(member)}</strong>
            <span class="amount-pill positive">${formatCurrency(amount)} owed</span>
          </div>
        `;
      }

      return `
        <div class="balance-item">
          <strong>${escapeHtml(member)}</strong>
          <span class="amount-pill negative">${formatCurrency(Math.abs(amount))} due</span>
        </div>
      `;
    })
    .join('');

  summary.innerHTML = items;
};

const renderSettlements = () => {
  const state = readData();
  const list = document.getElementById('settlementList');

  if (!state.settlements.length) {
    list.innerHTML = '<div class="empty-state">No settlement history yet.</div>';
    return;
  }

  list.innerHTML = state.settlements
    .slice()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .map(
      (entry) => `
        <div class="settlement-item">
          <div class="settlement-top">
            <div><strong>${escapeHtml(entry.from)}</strong> → <strong>${escapeHtml(entry.to)}</strong></div>
            <span class="settlement-status ${entry.settled ? 'settled' : 'pending'}">${entry.settled ? 'Settled' : 'Pending'}</span>
          </div>
          <div class="row-between">
            <span class="amount-pill">${formatCurrency(entry.amount)}</span>
            <span>${formatDate(entry.date)}</span>
          </div>
          <div class="expense-actions">
            <button class="action-button" data-action="toggle-settlement" data-id="${entry.id}" type="button">${entry.settled ? 'Reopen' : 'Mark as settled'}</button>
            <button class="action-button delete" data-action="delete-settlement" data-id="${entry.id}" type="button">Delete</button>
          </div>
        </div>
      `
    )
    .join('');
};

const renderGroupList = () => {
  const state = readData();
  const list = document.getElementById('groupList');

  if (!state.groups.length) {
    list.innerHTML = '<div class="empty-state">No groups yet. Create a group for roommates or classmates.</div>';
    return;
  }

  list.innerHTML = state.groups
    .map((group) => {
      const summary = getGroupSummary(state, group.id);
      if (!summary) return '';

      const memberCards = summary.members
        .map((member) => {
          const details = summary.totals[member] || { paid: 0, share: 0, net: 0 };
          return `
            <div class="member-row">
              <span class="member-name">${escapeHtml(member)}</span>
              <div class="expense-meta">
                <span>Paid ${formatCurrency(details.paid)}</span>
                <span>Share ${formatCurrency(details.share)}</span>
                <span class="amount-pill ${details.net >= 0 ? 'positive' : 'negative'}">${details.net >= 0 ? 'Owed' : 'Due'} ${formatCurrency(Math.abs(details.net))}</span>
              </div>
            </div>
          `;
        })
        .join('');

      const suggestions = summary.suggestions.length
        ? summary.suggestions
            .map(
              (item) => `<div class="member-row"><span>${escapeHtml(item.from)} → ${escapeHtml(item.to)}</span><span class="amount-pill">${formatCurrency(item.amount)}</span></div>`
            )
            .join('')
        : '<div class="empty-state">No outstanding balances.</div>';

      return `
        <div class="group-card">
          <div class="group-meta">
            <h4>${escapeHtml(group.name)}</h4>
            <span>${summary.expenses.length} shared expense(s)</span>
          </div>
          <div class="group-meta">
            <span>Total group spend: <strong>${formatCurrency(summary.totalSpent)}</strong></span>
          </div>
          <div class="member-list">${memberCards}</div>
          <div>
            <h4>Suggested settlements</h4>
            <div class="member-list">${suggestions}</div>
          </div>
        </div>
      `;
    })
    .join('');
};

const renderStatistics = () => {
  const state = readData();
  const currentMonth = state.settings.currentMonth || getCurrentMonthKey();
  const expenses = getExpensesForMonth(state.expenses, currentMonth);

  const total = expenses.reduce((sum, item) => sum + clampAmount(item.amount), 0);
  const maxExpense = expenses.length ? Math.max(...expenses.map((item) => clampAmount(item.amount))) : 0;
  const average = expenses.length ? total / expenses.length : 0;

  document.getElementById('totalSpendingStat').textContent = formatCurrency(total);
  document.getElementById('largestExpenseStat').textContent = formatCurrency(maxExpense);
  document.getElementById('averageExpenseStat').textContent = formatCurrency(average);
  document.getElementById('expenseNumberStat').textContent = String(expenses.length);

  const categoryTotals = getCategoryTotals(expenses);
  const chart = document.getElementById('categoryChart');
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    chart.innerHTML = '<div class="empty-state">No spending data for this month.</div>';
  } else {
    const maxValue = entries[0][1] || 1;
    chart.innerHTML = entries
      .map(
        ([category, amount]) => `
          <div class="category-row">
            <div class="category-label">
              <span>${escapeHtml(category)}</span>
              <strong>${formatCurrency(amount)}</strong>
            </div>
            <div class="bar-track">
              <span class="bar-fill" style="width:${(amount / maxValue) * 100}%"></span>
            </div>
          </div>
        `
      )
      .join('');
  }

  const monthlyHistory = document.getElementById('monthlyHistory');
  const monthOptions = getMonthOptions();
  const historyEntries = monthOptions
    .map((entry) => {
      const monthExpenses = getExpensesForMonth(state.expenses, entry.key);
      const monthTotal = monthExpenses.reduce((sum, item) => sum + clampAmount(item.amount), 0);
      return { ...entry, amount: monthTotal };
    })
    .slice(0, 6)
    .reverse();

  monthlyHistory.innerHTML = historyEntries
    .map(
      (entry) => `
        <div class="history-item">
          <span>${entry.label}</span>
          <strong>${formatCurrency(entry.amount)}</strong>
        </div>
      `
    )
    .join('');
};

const renderSettings = () => {
  const state = readData();
  const currentUserInput = document.getElementById('currentUserInput');
  currentUserInput.value = state.settings.currentUser || 'Akash';
  document.getElementById('currencySelect').value = state.settings.currency || 'INR';
};

const renderAll = () => {
  renderAppMonthOptions();
  renderSettings();
  renderDashboard();
  renderExpenseList();
  renderSplitSummary();
  renderSettlements();
  renderGroupList();
  renderStatistics();
};

const addExpense = (event) => {
  event.preventDefault();

  const state = readData();
  const nameInput = document.getElementById('expenseName');
  const amountInput = document.getElementById('expenseAmount');
  const categoryInput = document.getElementById('expenseCategory');
  const dateInput = document.getElementById('expenseDate');
  const noteInput = document.getElementById('expenseNote');

  const name = nameInput.value.trim();
  const amount = clampAmount(amountInput.value);
  const date = dateInput.value;

  if (!name) {
    showToast('Expense name cannot be empty.');
    nameInput.focus();
    return;
  }

  if (!amount) {
    showToast('Amount must be greater than zero.');
    amountInput.focus();
    return;
  }

  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    showToast('Please choose a valid date.');
    dateInput.focus();
    return;
  }

  const existingId = document.getElementById('expenseForm').dataset.editId;
  const nextExpense = {
    id: existingId || generateId('expense'),
    name,
    amount,
    category: categoryInput.value,
    date,
    note: noteInput.value.trim(),
    createdAt: new Date().toISOString()
  };

  if (existingId) {
    const index = state.expenses.findIndex((item) => item.id === existingId);
    if (index >= 0) state.expenses[index] = nextExpense;
  } else {
    state.expenses.push(nextExpense);
  }

  state.settings.currentMonth = date.slice(0, 7);
  saveData(state);
  document.getElementById('expenseForm').reset();
  delete document.getElementById('expenseForm').dataset.editId;
  document.getElementById('expenseFormTitle').textContent = 'Add expense';
  document.getElementById('cancelExpenseEdit').classList.add('hidden');
  renderAll();
  showToast('Expense saved successfully.');
};

const handleExpenseActions = (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const state = readData();

  if (action === 'edit-expense') {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return;

    document.getElementById('expenseName').value = expense.name;
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseCategory').value = expense.category;
    document.getElementById('expenseDate').value = expense.date;
    document.getElementById('expenseNote').value = expense.note || '';
    document.getElementById('expenseForm').dataset.editId = id;
    document.getElementById('expenseFormTitle').textContent = 'Edit expense';
    document.getElementById('cancelExpenseEdit').classList.remove('hidden');
    document.getElementById('expenseName').focus();
    return;
  }

  if (action === 'delete-expense') {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return;
    const confirmed = window.confirm(`Delete "${expense.name}"? This cannot be undone.`);
    if (!confirmed) return;

    state.expenses = state.expenses.filter((item) => item.id !== id);
    saveData(state);
    renderAll();
    showToast('Expense deleted.');
  }
};

const addSharedExpense = (event) => {
  event.preventDefault();

  const description = document.getElementById('splitDescription').value.trim();
  const amount = clampAmount(document.getElementById('splitAmount').value);
  const paidBy = document.getElementById('splitPaidBy').value.trim();
  const date = document.getElementById('splitDate').value;
  const rawParticipants = document.getElementById('splitParticipants').value;
  const groupId = document.getElementById('splitGroup').value;
  const state = readData();

  if (!description) {
    showToast('Please enter an expense description.');
    return;
  }

  if (!amount) {
    showToast('Amount must be greater than zero.');
    return;
  }

  if (!paidBy) {
    showToast('Please add the payer name.');
    return;
  }

  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    showToast('Please enter a valid date.');
    return;
  }

  const participants = rawParticipants
    ? rawParticipants.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  const uniqueParticipants = [...new Set([paidBy, ...participants])];

  if (!uniqueParticipants.length) {
    showToast('Add at least a participant.');
    return;
  }

  state.sharedExpenses.push({
    id: generateId('split'),
    description,
    amount,
    paidBy,
    participants: uniqueParticipants,
    groupId: groupId || '',
    date,
    createdAt: new Date().toISOString()
  });

  state.settings.currentMonth = date.slice(0, 7);
  saveData(state);
  document.getElementById('splitForm').reset();
  renderAll();
  showToast('Shared expense saved.');
};

const addSettlement = (event) => {
  event.preventDefault();

  const from = document.getElementById('settlementFrom').value.trim();
  const to = document.getElementById('settlementTo').value.trim();
  const amount = clampAmount(document.getElementById('settlementAmount').value);
  const date = document.getElementById('settlementDate').value;

  if (!from || !to) {
    showToast('Enter both payer and receiver names.');
    return;
  }

  if (!amount) {
    showToast('Settlement amount must be greater than zero.');
    return;
  }

  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    showToast('Choose a valid settlement date.');
    return;
  }

  const state = readData();
  state.settlements.push({
    id: generateId('settlement'),
    from,
    to,
    amount,
    date,
    settled: false,
    createdAt: new Date().toISOString()
  });

  saveData(state);
  document.getElementById('settlementForm').reset();
  renderSettlements();
  showToast('Settlement added.');
};

const createGroup = (event) => {
  event.preventDefault();

  const name = document.getElementById('groupName').value.trim();
  const membersRaw = document.getElementById('groupMembers').value;
  const state = readData();

  if (!name) {
    showToast('Group name is required.');
    return;
  }

  const members = membersRaw
    ? membersRaw.split(',').map((member) => member.trim()).filter(Boolean)
    : [];

  if (!members.length) {
    showToast('Add at least one member name.');
    return;
  }

  state.groups.push({
    id: generateId('group'),
    name,
    members: [...new Set(members)],
    createdAt: new Date().toISOString()
  });

  saveData(state);
  document.getElementById('groupForm').reset();
  renderAll();
  showToast('Group created.');
};

const populateSplitGroupOptions = () => {
  const state = readData();
  const groupSelect = document.getElementById('splitGroup');
  const groups = state.groups || [];
  groupSelect.innerHTML = '<option value="">No group</option>' + groups
    .map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`)
    .join('');
};

const resetBudget = () => {
  const state = readData();
  const monthKey = state.settings.currentMonth || getCurrentMonthKey();
  delete state.budgets[monthKey];
  saveData(state);
  renderDashboard();
  showToast('Budget reset for the selected month.');
};

const saveBudget = (event) => {
  event.preventDefault();

  const state = readData();
  const monthKey = state.settings.currentMonth || getCurrentMonthKey();
  const value = clampAmount(document.getElementById('budgetAmountInput').value);

  if (!value) {
    showToast('Budget must be greater than zero.');
    return;
  }

  state.budgets[monthKey] = value;
  saveData(state);
  renderDashboard();
  showToast('Monthly budget saved.');
};

const handleBudgetSelection = (event) => {
  const state = readData();
  state.settings.currentMonth = event.target.value;
  saveData(state);
  renderAll();
};

const toggleTheme = () => {
  const state = readData();
  state.settings.darkMode = !state.settings.darkMode;
  saveData(state);
  setTheme(state.settings.darkMode);
};

const clearAllData = () => {
  const confirmed = window.confirm('This will permanently delete all local data, including budgets, expenses, groups, and settlements. Continue?');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  showToast('All local data cleared.');
};

const exportData = () => {
  const state = readData();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'splitmate-backup.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Data exported.');
};

const importData = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const state = defaultState();
    const merged = {
      settings: { ...state.settings, ...(parsed.settings || {}) },
      budgets: parsed.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : {},
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      sharedExpenses: Array.isArray(parsed.sharedExpenses) ? parsed.sharedExpenses : [],
      settlements: Array.isArray(parsed.settlements) ? parsed.settlements : []
    };

    saveData(merged);
    event.target.value = '';
    renderAll();
    showToast('Data imported successfully.');
  } catch (error) {
    console.error('Invalid import', error);
    showToast('Invalid JSON backup. Please try another file.');
  }
};

const seedDemoData = () => {
  const now = new Date();
  const currentMonth = getCurrentMonthKey(now);
  const previousMonth = getCurrentMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const demo = {
    settings: {
      currency: 'INR',
      darkMode: false,
      currentUser: 'Akash',
      currentMonth
    },
    budgets: {
      [currentMonth]: 9000,
      [previousMonth]: 8000
    },
    expenses: [
      { id: 'demo-exp-1', name: 'Mess lunch', amount: 540, category: 'Food', date: `${currentMonth}-02`, note: 'Campus food' },
      { id: 'demo-exp-2', name: 'Metro pass', amount: 320, category: 'Travel', date: `${currentMonth}-07`, note: 'Recharge' },
      { id: 'demo-exp-3', name: 'Book purchase', amount: 850, category: 'Education', date: `${currentMonth}-12`, note: 'Semester book' },
      { id: 'demo-exp-4', name: 'Movie night', amount: 420, category: 'Entertainment', date: `${currentMonth}-15`, note: 'Weekend outing' },
      { id: 'demo-exp-5', name: 'Electricity bill', amount: 600, category: 'Bills', date: `${previousMonth}-18`, note: 'Hostel bill' }
    ],
    groups: [
      { id: 'demo-group-1', name: 'Roommates', members: ['Akash', 'Rahul', 'Aman', 'Priya'] }
    ],
    sharedExpenses: [
      { id: 'demo-split-1', description: 'Dinner', amount: 1200, paidBy: 'Akash', participants: ['Akash', 'Rahul', 'Aman'], groupId: 'demo-group-1', date: `${currentMonth}-09` },
      { id: 'demo-split-2', description: 'Groceries', amount: 1800, paidBy: 'Rahul', participants: ['Akash', 'Rahul', 'Aman', 'Priya'], groupId: 'demo-group-1', date: `${currentMonth}-14` }
    ],
    settlements: [
      { id: 'demo-settle-1', from: 'Rahul', to: 'Akash', amount: 300, date: `${currentMonth}-10`, settled: false },
      { id: 'demo-settle-2', from: 'Aman', to: 'Rahul', amount: 200, date: `${currentMonth}-14`, settled: true }
    ]
  };

  saveData(demo);
  renderAll();
  showToast('Demo data loaded.');
};

const bindStaticEvents = () => {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('settingsThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('monthSelector').addEventListener('change', handleBudgetSelection);
  document.getElementById('expenseMonthFilter').addEventListener('change', renderExpenseList);
  document.getElementById('expenseSearch').addEventListener('input', renderExpenseList);
  document.getElementById('expenseCategoryFilter').addEventListener('change', renderExpenseList);
  document.getElementById('budgetForm').addEventListener('submit', saveBudget);
  document.getElementById('resetBudgetBtn').addEventListener('click', resetBudget);
  document.getElementById('expenseForm').addEventListener('submit', addExpense);
  document.getElementById('cancelExpenseEdit').addEventListener('click', () => {
    document.getElementById('expenseForm').reset();
    delete document.getElementById('expenseForm').dataset.editId;
    document.getElementById('expenseFormTitle').textContent = 'Add expense';
    document.getElementById('cancelExpenseEdit').classList.add('hidden');
  });
  document.getElementById('expenseList').addEventListener('click', handleExpenseActions);
  document.getElementById('splitForm').addEventListener('submit', addSharedExpense);
  document.getElementById('settlementForm').addEventListener('submit', addSettlement);
  document.getElementById('groupForm').addEventListener('submit', createGroup);
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('demoDataBtn').addEventListener('click', seedDemoData);
  document.getElementById('importDataInput').addEventListener('change', importData);
  document.getElementById('currencySelect').addEventListener('change', (event) => {
    const state = readData();
    state.settings.currency = event.target.value;
    saveData(state);
    showToast('Currency saved.');
  });
  document.getElementById('currentUserInput').addEventListener('change', (event) => {
    const state = readData();
    state.settings.currentUser = event.target.value.trim() || 'Akash';
    saveData(state);
    renderAll();
  });
  document.getElementById('settlementList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const state = readData();
    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === 'toggle-settlement') {
      const item = state.settlements.find((entry) => entry.id === id);
      if (!item) return;
      item.settled = !item.settled;
      saveData(state);
      renderSettlements();
      showToast(item.settled ? 'Settlement marked settled.' : 'Settlement reopened.');
    }

    if (action === 'delete-settlement') {
      state.settlements = state.settlements.filter((entry) => entry.id !== id);
      saveData(state);
      renderSettlements();
      showToast('Settlement removed.');
    }
  });

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view;
      document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
      document.getElementById(nextView).classList.add('active');
      document.querySelectorAll('.nav-btn').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
};

const initializeApp = () => {
  const data = readData();
  const currentMonth = data.settings.currentMonth || getCurrentMonthKey();
  data.settings.currentMonth = currentMonth;
  saveData(data);
  setTheme(Boolean(data.settings.darkMode));
  populateSplitGroupOptions();
  bindStaticEvents();
  renderAll();
};

window.addEventListener('DOMContentLoaded', initializeApp);

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

window.addEventListener('storage', () => {
  renderAll();
});

window.addEventListener('load', () => {
  populateSplitGroupOptions();
  renderAll();
});

function formatCurrencyShort(value) {
  return formatCurrency(value);
}
