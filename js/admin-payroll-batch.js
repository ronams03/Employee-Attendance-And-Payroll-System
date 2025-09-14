/**
 * ADMIN PAYROLL BATCH FUNCTIONALITY
 * Handles payroll batch generation and management
 * Provides modal handling, form submission, list rendering, filters, and pagination
 */

(function() {
  'use strict';

  // Utilities
  const baseApiUrl = window.baseApiUrl || `${location.origin}/intro/api`;
  const peso = (n) => {
    const v = Number(n || 0);
    try { return v.toLocaleString(undefined, { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }); }
    catch { return `₱${v.toFixed(2)}`; }
  };
  const fmtDateTime = (s) => {
    try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toLocaleString(); } catch {}
    try {
      // try parsing without timezone
      if (s && /\d{4}-\d{2}-\d{2}/.test(String(s))) {
        const d = new Date(`${s}T00:00:00`);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
      }
    } catch {}
    return String(s || '');
  };
  function byId(id){ return document.getElementById(id); }

  // State
  const state = {
    items: [],
    page: 1,
    pageSize: 10,
    filters: { search: '', status: '', date: '' }
  };

  /**
   * Initialize payroll batch functionality
   * Sets up event listeners for the payroll batch UI
   */
  function initPayrollBatch() {
    try {
      // Get DOM elements
      const generateBtn = document.getElementById('btn-generate-batch');
      const modal = document.getElementById('generateBatchModal');
      const closeButtons = modal ? modal.querySelectorAll('[data-close]') : [];
      const generateFormBtn = document.getElementById('batch-generate');
      const pageSizeSel = byId('batch-page-size');
      const searchInput = byId('batch-filter-search');
      const statusSel = byId('batch-filter-status');
      const dateInput = byId('batch-filter-date');

      // Check if we're on the payroll batch page
      if (!generateBtn || !modal) {
        console.log('Payroll batch elements not found, not initializing');
        return;
      }

      // Preload list
      try { state.pageSize = Number(pageSizeSel && pageSizeSel.value || 10) || 10; } catch {}
      loadAndRenderBatches();

      // Generate batch button event listener
      generateBtn.addEventListener('click', function() {
        modal.classList.remove('hidden');
        // Populate departments dropdown when modal opens
        populateDepartments();
      });

      // Close button event listeners
      closeButtons.forEach(button => {
        button.addEventListener('click', function() {
          modal.classList.add('hidden');
        });
      });

      // Close modal when clicking backdrop only
      modal.addEventListener('click', function(e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-close') === 'true') {
          modal.classList.add('hidden');
        }
      });

      // Generate batch form submission
      if (generateFormBtn) {
        generateFormBtn.addEventListener('click', function() {
          handleBatchGeneration();
        });
      }

      // Filters
      if (pageSizeSel) pageSizeSel.addEventListener('change', () => { state.pageSize = Number(pageSizeSel.value) || 10; state.page = 1; renderBatches(); });
      let t = null;
      if (searchInput) searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.filters.search = searchInput.value.trim(); state.page = 1; loadAndRenderBatches(); }, 250); });
      if (statusSel) statusSel.addEventListener('change', () => { state.filters.status = statusSel.value; state.page = 1; loadAndRenderBatches(); });
      if (dateInput) dateInput.addEventListener('change', () => { state.filters.date = dateInput.value; state.page = 1; loadAndRenderBatches(); });

      console.log('Payroll batch functionality initialized');
    } catch (error) {
      console.error('Error initializing payroll batch functionality:', error);
    }
  }
  
  /**
   * Populate departments dropdown
   * Fetches all departments and populates the dropdown
   */
  function populateDepartments() {
    try {
      const departmentSelect = document.getElementById('batch-department');
      if (!departmentSelect) return;
      // Clear existing options except the first one
      while (departmentSelect.options.length > 1) { departmentSelect.remove(1); }
      // Show loading state
      const loadingOption = document.createElement('option');
      loadingOption.value = '';
      loadingOption.textContent = 'Loading departments...';
      loadingOption.disabled = true;
      departmentSelect.appendChild(loadingOption);
      // Fetch departments from API
      axios.get(`${baseApiUrl}/employees.php?operation=getDepartments`)
        .then(response => {
          const departments = response.data;
          // Clear loading option
          departmentSelect.innerHTML = '<option value="">All Departments</option>';
          if (Array.isArray(departments) && departments.length > 0) {
            departments.forEach(dept => {
              const option = document.createElement('option');
              if (typeof dept === 'string') { option.value = dept; option.textContent = dept; }
              else if (dept.dept_name) { option.value = dept.dept_name; option.textContent = dept.dept_name; }
              departmentSelect.appendChild(option);
            });
            departmentSelect.dispatchEvent(new Event('change'));
          }
        })
        .catch(error => {
          console.error('Error fetching departments:', error);
          departmentSelect.innerHTML = '<option value="">All Departments</option>';
          const errorOption = document.createElement('option');
          errorOption.value = ''; errorOption.textContent = 'Error loading departments'; errorOption.disabled = true;
          departmentSelect.appendChild(errorOption);
          try { Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load departments. Please try again.', confirmButtonText: 'OK' }); } catch {}
        });
    } catch (error) {
      console.error('Error populating departments:', error);
    }
  }

  /**
   * Create payroll batch via API
   */
  async function createBatchViaApi(payload){
    const fd = new FormData();
    fd.append('operation', 'createPayrollBatch');
    fd.append('json', JSON.stringify(payload));
    const res = await axios.post(`${baseApiUrl}/payroll.php`, fd, { withCredentials: true });
    return res && res.data ? res.data : { success: false };
  }

  /**
   * Handle batch generation form submission
   * Processes the form data and generates a payroll batch
   */
  async function handleBatchGeneration() {
    try {
      // Get form data
      const batchName = document.getElementById('batch-name').value.trim();
      const periodStart = document.getElementById('batch-period-start').value;
      const periodEnd = document.getElementById('batch-period-end').value;
      const department = document.getElementById('batch-department').value;
      const notesEl = document.getElementById('batch-notes');
      const notes = notesEl ? notesEl.value.trim() : '';
      
      // Validation
      if (!batchName) {
        try { await Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a batch name', confirmButtonText: 'OK' }); } catch {}
        return;
      }
      if (!periodStart || !periodEnd) {
        try { await Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select both start and end dates', confirmButtonText: 'OK' }); } catch {}
        return;
      }

      // Create via API
      const payload = { batch_name: batchName, payroll_period_start: periodStart, payroll_period_end: periodEnd };
      if (department) payload.department = department;
      if (notes) payload.notes = notes;

      // Disable button during submit
      const btn = byId('batch-generate');
      const old = btn ? btn.disabled : null;
      if (btn) btn.disabled = true;
      let ok = false; let msg = '';
      try {
        const resp = await createBatchViaApi(payload);
        ok = !!resp.success;
        msg = ok ? `Batch created${resp.batch_id ? ` (ID ${resp.batch_id})` : ''}` : (resp.message || 'Failed to create batch');
      } catch (e) {
        ok = false; msg = 'Failed to create batch';
      }
      if (btn && old !== null) btn.disabled = old;

      if (ok) {
        try { await Swal.fire({ icon: 'success', title: 'Batch Generated', text: 'Payroll batch has been generated successfully!', confirmButtonText: 'OK' }); } catch {}
        // Close the modal
        document.getElementById('generateBatchModal').classList.add('hidden');
        // Reset form
        document.getElementById('batch-name').value = '';
        document.getElementById('batch-period-start').value = '';
        document.getElementById('batch-period-end').value = '';
        document.getElementById('batch-department').value = '';
        const notesEl = document.getElementById('batch-notes');
        if (notesEl) notesEl.value = '';
        // Refresh list
        await loadAndRenderBatches();
      } else {
        try { await Swal.fire({ icon: 'error', title: 'Error', text: msg || 'Failed to generate payroll batch. Please try again.', confirmButtonText: 'OK' }); } catch {}
      }
    } catch (error) {
      console.error('Error handling batch generation:', error);
      try { await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to generate payroll batch. Please try again.', confirmButtonText: 'OK' }); } catch {}
    }
  }

  /**
   * Fetch batches from API using current filters
   */
  async function fetchBatches(){
    const params = { operation: 'listPayrollBatches' };
    if (state.filters.search) params.search = state.filters.search;
    if (state.filters.status) params.status = state.filters.status;
    if (state.filters.date) params.date = state.filters.date;
    const res = await axios.get(`${baseApiUrl}/payroll.php`, { params, withCredentials: true });
    const items = Array.isArray(res && res.data) ? res.data : [];
    // Ensure numeric fields are numbers
    return items.map(r => ({
      ...r,
      total_employees: Number(r.total_employees || 0),
      total_amount: Number(r.total_amount || 0)
    }));
  }

  async function loadAndRenderBatches(){
    try {
      const items = await fetchBatches();
      state.items = items;
      renderBatches();
    } catch (e) {
      console.error('Failed to load payroll batches:', e);
      state.items = [];
      renderBatches();
    }
  }

  function renderBatches(){
    const tbody = byId('batch-tbody');
    const pag = byId('batch-pagination');
    if (!tbody) return;

    const total = state.items.length;
    const pageSize = state.pageSize || 10;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    const startIdx = (state.page - 1) * pageSize;
    const pageItems = state.items.slice(startIdx, startIdx + pageSize);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-6 text-sm text-center text-gray-500">No payroll batches found</td></tr>';
    } else {
      tbody.innerHTML = pageItems.map((r, i) => {
        const idx = startIdx + i + 1;
        const created = fmtDateTime(r.created_at);
        const statusClass = (() => {
          const s = String(r.status || '').toLowerCase();
          if (s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
          if (s === 'processing') return 'bg-amber-50 text-amber-700 border-amber-200';
          if (s === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
          return 'bg-gray-50 text-gray-700 border-gray-200';
        })();
        const status = String(r.status || 'pending').replace(/^./, c => c.toUpperCase());
        const bname = (r.batch_name || '').toString();
        return `
          <tr>
            <td class="px-3 py-2 text-sm text-gray-700">${idx}</td>
            <td class="px-3 py-2 text-sm text-gray-900 font-medium">${escapeHtml(bname)}</td>
            <td class="px-3 py-2 text-sm text-gray-700">${created}</td>
            <td class="px-3 py-2 text-sm text-gray-700">${r.total_employees}</td>
            <td class="px-3 py-2 text-sm">
              <button class="inline-flex items-center px-2 py-0.5 rounded border ${statusClass} text-xs font-medium hover:ring-2 hover:ring-primary-600 focus:outline-none" data-action="toggle-status" data-id="${r.batch_id}" data-status="${String(r.status || 'pending').toLowerCase()}">${status}</button>
            </td>
            <td class="px-3 py-2 text-sm text-gray-700">${peso(r.total_amount)}</td>
            <td class="px-3 py-2 text-sm text-right">
              <div class="relative inline-flex justify-center" data-batch-menu-container>
                <button class="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100" aria-label="Actions" data-action="menu-toggle">
                  <span class="text-gray-600 font-bold text-lg">•••</span>
                </button>
                <div class="hidden origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10" role="menu" data-menu>
                  <div class="py-1">
                    <button class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-menu-action="view" data-id="${r.batch_id}" role="menuitem">View</button>
                    <button class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-menu-action="edit" data-id="${r.batch_id}" role="menuitem">Edit</button>
                    <button class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-menu-action="complete" data-id="${r.batch_id}" role="menuitem">Complete</button>
                  </div>
                </div>
              </div>
            </td>
          </tr>`;
      }).join('');
      // Wire 3-dots action menus
      try {
        // Close any open menus before opening a new one
        const closeAllMenus = () => {
          document.querySelectorAll('[data-batch-menu-container] [data-menu]').forEach(m => m.classList.add('hidden'));
        };
        tbody.querySelectorAll('[data-batch-menu-container]').forEach(container => {
          const toggleBtn = container.querySelector('[data-action="menu-toggle"]');
          const menu = container.querySelector('[data-menu]');
          if (toggleBtn && menu) {
            toggleBtn.addEventListener('click', (ev) => {
              ev.preventDefault(); ev.stopPropagation();
              closeAllMenus();
              menu.classList.toggle('hidden');
            });
          }
          const viewBtn = container.querySelector('[data-menu-action="view"]');
          if (viewBtn) viewBtn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            if (menu) menu.classList.add('hidden');
            const id = parseInt(viewBtn.getAttribute('data-id'), 10);
            if (!id) return;
            await openViewBatchModal(id);
          });
          const editBtn = container.querySelector('[data-menu-action="edit"]');
          if (editBtn) editBtn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            if (menu) menu.classList.add('hidden');
            const id = parseInt(editBtn.getAttribute('data-id'), 10);
            if (!id) return;
            await openEditBatchModal(id);
          });
          const completeBtn = container.querySelector('[data-menu-action="complete"]');
          if (completeBtn) completeBtn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            if (menu) menu.classList.add('hidden');
            const id = parseInt(completeBtn.getAttribute('data-id'), 10);
            if (!id) return;
            await setBatchStatus(id, 'completed');
          });
        });
        if (!window.__batchMenuGlobalClose) {
          window.__batchMenuGlobalClose = true;
          document.addEventListener('click', () => {
            document.querySelectorAll('[data-batch-menu-container] [data-menu]').forEach(m => m.classList.add('hidden'));
          });
        }
      } catch (e) { console.error('Wire batch action menus failed', e); }
      // Wire clickable status toggle similar to payroll page
      try {
        tbody.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
          btn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const id = parseInt(btn.getAttribute('data-id'), 10);
            if (!id) return;
            const curr = String(btn.getAttribute('data-status') || '').toLowerCase();
            const next = (curr === 'completed') ? 'processing' : 'completed';
            await setBatchStatus(id, next);
          });
        });
      } catch (e) { console.error('Wire status toggle failed', e); }
    }

    if (pag) {
      const prevDisabled = state.page <= 1 ? 'opacity-50 pointer-events-none' : '';
      const nextDisabled = state.page >= pages ? 'opacity-50 pointer-events-none' : '';
      pag.innerHTML = `
        <div>Showing ${(total === 0) ? 0 : (startIdx + 1)}-${Math.min(total, startIdx + pageSize)} of ${total}</div>
        <div class="flex items-center gap-2">
          <button id="batch-prev" class="px-2 py-1 rounded border ${prevDisabled}">Prev</button>
          <span>Page ${state.page} / ${pages}</span>
          <button id="batch-next" class="px-2 py-1 rounded border ${nextDisabled}">Next</button>
        </div>`;
      const prev = byId('batch-prev');
      const next = byId('batch-next');
      if (prev) prev.addEventListener('click', () => { if (state.page > 1) { state.page--; renderBatches(); } });
      if (next) next.addEventListener('click', () => { if (state.page < pages) { state.page++; renderBatches(); } });
    }
  }

  // Simple HTML escape to prevent XSS in names
  function escapeHtml(text){
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchBatch(batchId){
    const res = await axios.get(`${baseApiUrl}/payroll.php`, { params: { operation: 'getPayrollBatch', batch_id: batchId }, withCredentials: true });
    const d = res && res.data ? res.data : null;
    if (!d || !d.success) throw new Error('Batch not found');
    return d.batch;
  }
  async function fetchBatchEmployees(batchId){
    const res = await axios.get(`${baseApiUrl}/payroll.php`, { params: { operation: 'listPayrollBatchEmployees', batch_id: batchId }, withCredentials: true });
    const items = Array.isArray(res && res.data) ? res.data : [];
    return items.map(r => ({
      ...r,
      basic_salary: Number(r.basic_salary || 0),
      overtime_pay: Number(r.overtime_pay || 0),
      deductions: Number(r.deductions || 0),
      net_pay: Number(r.net_pay || 0)
    }));
  }

  async function openViewBatchModal(batchId){
    try {
      const [batch, employees] = await Promise.all([fetchBatch(batchId), fetchBatchEmployees(batchId)]);
      const total = employees.reduce((s, r) => s + (Number(r.net_pay) || 0), 0);
      const body = document.body;
      const wrap = document.createElement('div');
      wrap.id = 'viewBatchModal';
      wrap.className = 'fixed inset-0 z-50 overflow-y-auto';
      wrap.innerHTML = `
        <div class="absolute inset-0 bg-black/50" data-close="1"></div>
        <div class="relative mx-auto mt-12 w-[min(1100px,92vw)]">
          <div class="bg-white rounded-lg shadow max-h-[85vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h5 class="font-semibold">${escapeHtml(batch.batch_name || '')}</h5>
              </div>
              <button class="text-gray-500 text-xl" data-close="1">×</button>
            </div>
            <div class="p-4 overflow-y-auto flex-1">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 text-sm">
                <div><div class="text-gray-500">Period Start</div><div class="font-medium">${escapeHtml(batch.payroll_period_start || '')}</div></div>
                <div><div class="text-gray-500">Period End</div><div class="font-medium">${escapeHtml(batch.payroll_period_end || '')}</div></div>
                <div><div class="text-gray-500">Department</div><div class="font-medium">${escapeHtml(batch.department || 'All')}</div></div>
                <div><div class="text-gray-500">Total Amount</div><div class="font-medium">${peso(batch.total_amount)}</div></div>
              </div>
              <div class="overflow-x-auto border rounded">
                <table class="min-w-full">
                  <thead class="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th class="px-3 py-2 text-left">Employee</th>
                      <th class="px-3 py-2 text-left">Department</th>
                      <th class="px-3 py-2 text-left">Basic Salary</th>
                      <th class="px-3 py-2 text-left">Overtime Pay</th>
                      <th class="px-3 py-2 text-left">Deductions</th>
                      <th class="px-3 py-2 text-left">Net Pay</th>
                      <th class="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">${employees.length ? employees.map(r => `
                    <tr class="text-sm">
                      <td class="px-3 py-2">${escapeHtml(`${r.last_name || ''}, ${r.first_name || ''}`.trim())}</td>
                      <td class="px-3 py-2">${escapeHtml(r.department || '')}</td>
                      <td class="px-3 py-2">${peso(r.basic_salary)}</td>
                      <td class="px-3 py-2">${peso(r.overtime_pay)}</td>
                      <td class="px-3 py-2">${peso(r.deductions)}</td>
                      <td class="px-3 py-2 font-medium">${peso(r.net_pay)}</td>
                      <td class="px-3 py-2">${escapeHtml(String(r.status || 'pending'))}</td>
                    </tr>`).join('') : `<tr><td colspan="7" class="px-3 py-6 text-center text-gray-500">No employees</td></tr>`}
                  </tbody>
                  <tfoot class="bg-gray-50 text-sm">
                    <tr>
                      <td class="px-3 py-2 font-medium" colspan="5">Totals</td>
                      <td class="px-3 py-2 font-semibold">${peso(total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div class="flex justify-end gap-2 border-t px-4 py-3">
              <button class="px-3 py-2 text-sm rounded border" data-close="1">Close</button>
            </div>
          </div>
        </div>`;
      body.appendChild(wrap);
      const closes = wrap.querySelectorAll('[data-close]');
      closes.forEach(b => b.addEventListener('click', () => { try { wrap.remove(); } catch {} }));
    } catch (e) {
      console.error('Failed to open view modal', e);
      try { await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load batch details', confirmButtonText: 'OK' }); } catch {}
    }
  }

  // Helpers to update status and edit batches
  async function setBatchStatus(batchId, status){
    try {
      const fd = new FormData();
      fd.append('operation', 'setPayrollBatchStatus');
      fd.append('json', JSON.stringify({ batch_id: batchId, status }));
      const res = await axios.post(`${baseApiUrl}/payroll.php`, fd, { withCredentials: true });
      const ok = res && res.data && res.data.success;
      if (ok) {
        try { await Swal.fire({ icon: 'success', title: 'Updated', text: 'Batch status updated', confirmButtonText: 'OK' }); } catch {}
        await loadAndRenderBatches();
      } else {
        const msg = (res && res.data && res.data.message) || 'Failed to update status';
        try { await Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonText: 'OK' }); } catch {}
      }
    } catch (e) {
      try { await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update status', confirmButtonText: 'OK' }); } catch {}
    }
  }

  async function openEditBatchModal(batchId){
    try {
      // Fetch batch details
      const resp = await axios.get(`${baseApiUrl}/payroll.php`, { params: { operation: 'getPayrollBatch', batch_id: batchId }, withCredentials: true });
      const d = resp && resp.data && resp.data.batch;
      if (!d) throw new Error('Batch not found');

      const body = document.body;
      const wrap = document.createElement('div');
      wrap.id = 'editBatchModal';
      wrap.className = 'fixed inset-0 z-50 overflow-y-auto';
      wrap.innerHTML = `
        <div class="absolute inset-0 bg-black/50" data-close="1"></div>
        <div class="relative mx-auto mt-12 w-[min(600px,92vw)]">
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="flex items-center justify-between border-b px-4 py-3">
              <h5 class="font-semibold">Edit Payroll Batch</h5>
              <button class="text-gray-500 text-xl" data-close="1">×</button>
            </div>
            <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-600 mb-1">Batch Name</label>
                <input id="edit-batch-name" type="text" class="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">Pay Period Start</label>
                <input id="edit-period-start" type="date" class="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">Pay Period End</label>
                <input id="edit-period-end" type="date" class="w-full border rounded px-3 py-2" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-600 mb-1">Department</label>
                <select id="edit-department" class="w-full border rounded px-3 py-2">
                  <option value="">All Departments</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 border-t px-4 py-3">
              <button class="px-3 py-2 text-sm rounded border" data-close="1">Cancel</button>
              <button id="edit-batch-save" class="px-3 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700">Save</button>
            </div>
          </div>
        </div>`;
      body.appendChild(wrap);

      // Prefill values
      const nameEl = wrap.querySelector('#edit-batch-name');
      const psEl = wrap.querySelector('#edit-period-start');
      const peEl = wrap.querySelector('#edit-period-end');
      const deptSel = wrap.querySelector('#edit-department');
      if (nameEl) nameEl.value = d.batch_name || '';
      if (psEl) psEl.value = d.payroll_period_start || '';
      if (peEl) peEl.value = d.payroll_period_end || '';

      // Populate departments
      try {
        const resDept = await axios.get(`${baseApiUrl}/employees.php?operation=getDepartments`);
        const depts = resDept && resDept.data || [];
        if (Array.isArray(depts) && depts.length && deptSel) {
          depts.forEach(item => {
            const opt = document.createElement('option');
            if (typeof item === 'string') { opt.value = item; opt.textContent = item; }
            else if (item && item.dept_name) { opt.value = item.dept_name; opt.textContent = item.dept_name; }
            deptSel.appendChild(opt);
          });
        }
        if (deptSel) deptSel.value = d.department || '';
      } catch {}

      // Close handlers
      wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { try { wrap.remove(); } catch {} }));

      // Save handler
      const saveBtn = wrap.querySelector('#edit-batch-save');
      if (saveBtn) saveBtn.addEventListener('click', async () => {
        const payload = { batch_id: batchId };
        if (nameEl) payload.batch_name = nameEl.value.trim();
        if (psEl) payload.payroll_period_start = psEl.value;
        if (peEl) payload.payroll_period_end = peEl.value;
        if (deptSel) payload.department = deptSel.value;

        if (!payload.batch_name) {
          try { await Swal.fire({ icon: 'warning', title: 'Validation', text: 'Batch name is required', confirmButtonText: 'OK' }); } catch {}
          return;
        }
        if (!payload.payroll_period_start || !payload.payroll_period_end) {
          try { await Swal.fire({ icon: 'warning', title: 'Validation', text: 'Please select both start and end dates', confirmButtonText: 'OK' }); } catch {}
          return;
        }

        try {
          const fd = new FormData();
          fd.append('operation', 'updatePayrollBatch');
          fd.append('json', JSON.stringify(payload));
          const res2 = await axios.post(`${baseApiUrl}/payroll.php`, fd, { withCredentials: true });
          const ok = res2 && res2.data && res2.data.success;
          if (ok) {
            try { await Swal.fire({ icon: 'success', title: 'Saved', text: 'Batch updated successfully', confirmButtonText: 'OK' }); } catch {}
            try { wrap.remove(); } catch {}
            await loadAndRenderBatches();
          } else {
            const msg = (res2 && res2.data && res2.data.message) || 'Failed to update batch';
            try { await Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonText: 'OK' }); } catch {}
          }
        } catch (e) {
          try { await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update batch', confirmButtonText: 'OK' }); } catch {}
        }
      });
    } catch (e) {
      try { await Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load batch for edit', confirmButtonText: 'OK' }); } catch {}
    }
  }

  // Initialize when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPayrollBatch);
  } else {
    initPayrollBatch();
  }
  
  // Expose functions to global scope if needed
  window.handleBatchGeneration = handleBatchGeneration;
})();
