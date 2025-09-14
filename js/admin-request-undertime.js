/**
 * ADMIN UNDERTIME REQUEST MANAGEMENT
 * Handles undertime request submissions, approvals, and employee management
 * Provides filtering and search capabilities for administrative oversight
 */
(function(){
  const baseApiUrl = `${location.origin}/intro/api`;
  window.baseApiUrl = baseApiUrl;

  /**
   * LOCAL STATE MANAGEMENT
   * Maintains application state for filtering, pagination, and data
   */
  let allItems = [];
  let employees = [];
  let query = '';
  let page = 1;
  let pageSize = 10;
  let statusFilter = 'pending';
  let deptFilter = '';

  function toTitleCase(s){
    return String(s||'')
      .toLowerCase()
      .split(/([ -])/)
      .map(part => (/^[ -]$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
  }

  function escapeHtml(text){
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * LOAD EMPLOYEE DATA FROM API
   * Fetches all employees for selection and filtering purposes
   */
  async function loadEmployees(){
    try{
      const res = await axios.get(`${baseApiUrl}/employees.php`, { params: { operation: 'getEmployees' } });
      employees = Array.isArray(res.data) ? res.data : [];
    }catch{ employees = []; }
  }

  /**
   * LOAD DEPARTMENT FILTER OPTIONS
   * Populates department dropdown for filtering undertime requests
   */
  async function loadDepartments(){
    try {
      const sel = document.getElementById('ut-req-dept-filter');
      if (!sel) return;
      const res = await axios.get(`${baseApiUrl}/employees.php`, { params: { operation: 'getDepartments' } });
      const list = Array.isArray(res.data) ? res.data : [];
      sel.innerHTML = '<option value="">All Departments</option>' + list.map(d => `<option value="${d}">${d}</option>`).join('');
    } catch {}
  }

  /**
   * LOAD ALL UNDERTIME REQUESTS
   * Fetches undertime data from API for display and processing
   */
  async function loadUndertime(){
    try{
      console.log('Loading undertime requests...');
      const res = await axios.get(`${baseApiUrl}/undertime.php`, { params: { operation: 'listAll' } });
      console.log('API Response:', res.data);
      allItems = Array.isArray(res.data) ? res.data : [];
      console.log('Loaded items:', allItems.length);
    }catch(error){ 
      console.error('Error loading undertime:', error);
      allItems = []; 
    }
  }

  /**
   * GET EMPLOYEE DEPARTMENT FOR ROW
   * Retrieves department info from request data or employee lookup
   */
  function getRowDept(it){
    const d = String(it.department || '').trim();
    if (d) return d;
    const emp = employees.find(e => String(e.employee_id) === String(it.employee_id));
    return emp && emp.department ? emp.department : '';
  }

  /**
   * GENERATE STATUS BADGE HTML
   * Creates colored status badges for approval workflow states
   */
  function statusBadge(st){
    const s = String(st||'').toLowerCase();
    let cls = 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ';
    let label = 'Pending';
    if (s === 'approved' || s === 'approve') { cls += 'bg-green-50 text-green-700 ring-green-200'; label = 'Approved'; }
    else if (s === 'rejected' || s === 'reject') { cls += 'bg-red-50 text-red-700 ring-red-200'; label = 'Rejected'; }
    else { cls += 'bg-yellow-50 text-yellow-700 ring-yellow-200'; label = 'Pending'; }
    return `<span class="${cls}">${label}</span>`;
  }

  function formatWorkDate(s){
    if (!s) return '';
    try {
      const d = new Date(String(s).includes('T') ? s : `${s}T00:00:00`);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return s; }
  }
  function formatTime12(timeStr){
    try {
      const parts = String(timeStr || '').split(':');
      if (parts.length < 2) return String(timeStr || '');
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) || 0;
      if (!Number.isFinite(h)) return String(timeStr || '');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      const mm = String(m).padStart(2, '0');
      return `${h}:${mm} ${ampm}`;
    } catch { return String(timeStr || ''); }
  }

  /**
   * RENDER EMPLOYEE SELECTION OPTIONS
   * Populates employee dropdown with search functionality
   */
  function renderEmpOptions(list, selected){
    const sel = document.getElementById('ut-emp');
    if (!sel) return;
    const cur = selected != null ? String(selected) : '';
    sel.innerHTML = '';
    list.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.employee_id;
      const nm = toTitleCase(`${e.first_name || ''} ${e.last_name || ''}`.trim());
      opt.textContent = nm;
      if (cur && String(cur) === String(e.employee_id)) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  /**
   * WIRE EMPLOYEE SEARCH FUNCTIONALITY
   * Enables real-time filtering of employee dropdown options
   */
  function wireEmpSearch(){
    const input = document.getElementById('ut-emp-search');
    if (!input) return;
    input.oninput = () => {
      const q = (input.value || '').toLowerCase().trim();
      const selected = document.getElementById('ut-emp')?.value || '';
      const filtered = !q ? employees.slice() : employees.filter(e => `${(e.first_name||'').toLowerCase()} ${(e.last_name||'').toLowerCase()}`.includes(q) || String(e.email||'').toLowerCase().includes(q));
      renderEmpOptions(filtered, selected);
    };
  }

  /**
   * OPEN UNDERTIME REQUEST MODAL
   * Initializes modal with employee data and search capabilities
   */
  async function openUt(){
    await loadEmployees();
    renderEmpOptions(employees);
    wireEmpSearch();
    
    const modal = document.getElementById('adminUtModal');
    if (modal) {
      // Reset modal state for new request
      delete modal.dataset.editingId;
      const title = modal.querySelector('h5');
      const saveBtn = document.getElementById('ut-save');
      if (title) title.textContent = 'Request Undertime';
      if (saveBtn) saveBtn.textContent = 'Submit';
      
      // Clear form fields
      const dateInput = document.getElementById('ut-date');
      const endTimeInput = document.getElementById('ut-end');
      const reasonInput = document.getElementById('ut-reason');
      const searchInput = document.getElementById('ut-emp-search');
      
      if (dateInput) dateInput.value = '';
      if (endTimeInput) endTimeInput.value = '';
      if (reasonInput) reasonInput.value = '';
      if (searchInput) searchInput.value = '';
      
      modal.classList.remove('hidden');
    }
  }

  function closeUt(){
    const modal = document.getElementById('adminUtModal');
    if (modal) modal.classList.add('hidden');
  }

  /**
   * SUBMIT UNDERTIME REQUEST
   * Validates form data and sends undertime request to API
   * Calculates hours based on shift end time difference
   * Handles both creating new requests and updating existing ones
   */
  async function submitUndertime(){
    const modal = document.getElementById('adminUtModal');
    const editingId = modal?.dataset.editingId;
    const isEditing = !!editingId;
    
    const employee_id = document.getElementById('ut-emp')?.value;
    const work_date = document.getElementById('ut-date')?.value;
    const end_time = document.getElementById('ut-end')?.value || '';
    const reason = document.getElementById('ut-reason')?.value || '';
    const toMinutes = (t) => { const parts = String(t).split(':').map(n => parseInt(n,10)); const h = parts[0]||0, m = parts[1]||0; return h*60 + m; };
    // Compute undertime hours as difference between shift end and selected time out
    const SHIFT_END = '20:00';
    let hours = 0;
    if (end_time) {
      const se = toMinutes(SHIFT_END);
      const b = toMinutes(end_time);
      const diff = se - b;
      hours = diff > 0 ? (diff / 60) : 0;
    }
    if (!employee_id || !work_date || !end_time || !Number.isFinite(hours) || hours <= 0){ alert('Select employee, date, and a valid time out'); return; }
    
    const fd = new FormData();
    if (isEditing) {
      fd.append('operation', 'updateUndertime');
      fd.append('json', JSON.stringify({ ut_id: editingId, employee_id, work_date, hours, start_time: null, end_time, reason }));
    } else {
      fd.append('operation', 'requestUndertime');
      fd.append('json', JSON.stringify({ employee_id, work_date, hours, start_time: null, end_time, reason }));
    }
    
    try{
      await axios.post(`${baseApiUrl}/undertime.php`, fd);
      closeUt();
      
      // Reset modal state
      if (modal) {
        delete modal.dataset.editingId;
        const title = modal.querySelector('h5');
        const saveBtn = document.getElementById('ut-save');
        if (title) title.textContent = 'Request Undertime';
        if (saveBtn) saveBtn.textContent = 'Submit';
      }
      
      alert(isEditing ? 'Undertime request updated' : 'Undertime request submitted');
      await loadUndertime();
      page = 1;
      render();
    }catch{
      alert(isEditing ? 'Failed to update undertime' : 'Failed to submit undertime');
    }
  }

  /**
   * SUBMIT APPROVAL/REJECTION DECISION
   * Processes admin decisions on undertime requests
   */
  async function submitDecision(it, op){
    try{
      const fd = new FormData();
      fd.append('operation', op === 'approve' ? 'approve' : 'reject');
      fd.append('json', JSON.stringify({ ut_id: it.ut_id || it.id }));
      await axios.post(`${baseApiUrl}/undertime.php`, fd);
    } catch {}
  }

  /**
   * GET FILTERED UNDERTIME REQUESTS
   * Applies search, status, and department filters to data
   * Returns filtered array for display
   */
  function getFiltered(){
    const q = (query || '').toLowerCase();
    const s = (statusFilter || 'pending').toLowerCase();
    let base = allItems.slice();
    // Only undertime items if API returns mixed kinds (safety)
    base = base.filter(it => (String(it.kind||'').toLowerCase() || 'undertime') === 'undertime' || it.ut_id != null);
    if (s !== 'all') {
      base = base.filter(it => {
        const st = String(it.status || '').toLowerCase();
        if (s === 'approved' || s === 'approve') return st === 'approved' || st === 'approve';
        if (s === 'rejected' || s === 'reject') return st === 'rejected' || st === 'reject';
        return st === 'pending';
      });
    }
    if (deptFilter) {
      base = base.filter(it => String(getRowDept(it) || '').toLowerCase() === deptFilter);
    }
    if (!q) return base;
    return base.filter(it => {
      const name = `${it.first_name || ''} ${it.last_name || ''}`.toLowerCase();
      const date = (it.work_date || '').toLowerCase();
      const reason = (it.reason || '').toLowerCase();
      const st = (it.status || '').toLowerCase();
      const dept = String(getRowDept(it) || '').toLowerCase();
      return name.includes(q) || date.includes(q) || reason.includes(q) || st.includes(q) || dept.includes(q);
    });
  }

  function render(){
    const tbody = document.getElementById('ut-requests-tbody');
    const pager = document.getElementById('ut-requests-pagination');
    if (!tbody) return;

    const rows = getFiltered();
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const startIdx = (page - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageRows = rows.slice(startIdx, endIdx);

    tbody.innerHTML = '';
    if (!pageRows.length){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" class="px-3 py-6 text-sm text-center text-gray-500">No undertime requests</td>`;
      tbody.appendChild(tr);
    } else {
      pageRows.forEach((it, idx) => {
        const tr = document.createElement('tr');
        const name = toTitleCase(`${it.first_name || ''} ${it.last_name || ''}`.trim());
        const dept = toTitleCase(getRowDept(it) || '');
        tr.innerHTML = `
          <td class="px-3 py-2 text-sm text-gray-700">${startIdx + idx + 1}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${name}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${dept}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${formatWorkDate(it.work_date) || ''}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${formatTime12(it.end_time) || ''}</td>
          <td class="px-3 py-2 text-sm text-gray-700 truncate max-w-[20rem]" title="${escapeHtml(it.reason || '')}">${escapeHtml(it.reason || '')}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${statusBadge(it.status)}</td>
          <td class="px-3 py-2 text-sm text-right">
            <div class="relative inline-block text-left" data-ut-menu-container data-idx="${idx}">
              <button class="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100" aria-label="Actions" data-action="menu-toggle">
                <span class="text-gray-600 font-bold text-lg">•••</span>
              </button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      });

      // Wire dropdown menu actions with external positioning
      const containers = tbody.querySelectorAll('[data-ut-menu-container]');
      containers.forEach((container) => {
        const idx = parseInt(container.getAttribute('data-idx'), 10);
        const toggle = container.querySelector('[data-action="menu-toggle"]');
        if (!toggle) return;
        
        toggle.addEventListener('click', (ev) => {
          ev.preventDefault(); 
          ev.stopPropagation();
          
          const row = pageRows[idx];
          if (!row) return;
          
          // Close any existing dropdown
          closeDropdownMenu();
          
          // Create and show dropdown
          showDropdownMenu(toggle, row);
        });
      });

      // Global click handler to close menus
      if (!window.__utMenuGlobalClose) {
        window.__utMenuGlobalClose = true;
        document.addEventListener('click', (ev) => {
          const dropdown = document.getElementById('ut-dropdown-menu');
          if (dropdown && !dropdown.contains(ev.target)) {
            closeDropdownMenu();
          }
        });
      }
    }

    if (pager){
      const showingFrom = total === 0 ? 0 : (startIdx + 1);
      const showingTo = endIdx;
      pager.innerHTML = `
        <div class="text-sm text-gray-600">Showing ${showingFrom}–${showingTo} of ${total} results</div>
        <div class="flex items-center gap-2">
          <button id="ut-req-prev" class="px-2 py-1 text-xs rounded border hover:bg-gray-50 ${page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}">Prev</button>
          <span class="text-sm text-gray-600">Page ${page} of ${totalPages}</span>
          <button id="ut-req-next" class="px-2 py-1 text-xs rounded border hover:bg-gray-50 ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}">Next</button>
        </div>`;
      const prev = document.getElementById('ut-req-prev');
      const next = document.getElementById('ut-req-next');
      if (prev) prev.addEventListener('click', () => { if (page > 1) { page -= 1; render(); } });
      if (next) next.addEventListener('click', () => { if (page < totalPages) { page += 1; render(); } });
    }
  }

  /**
   * OPEN EDIT MODAL FOR UNDERTIME REQUEST
   * Allows editing of undertime request details
   */
  function openEditModal(request) {
    // Populate the existing modal with request data for editing
    const modal = document.getElementById('adminUtModal');
    if (!modal) return;
    
    // Load employees and set up the modal
    loadEmployees().then(() => {
      renderEmpOptions(employees, request.employee_id);
      wireEmpSearch();
      
      // Populate form fields with existing data
      const empSelect = document.getElementById('ut-emp');
      const dateInput = document.getElementById('ut-date');
      const endTimeInput = document.getElementById('ut-end');
      const reasonInput = document.getElementById('ut-reason');
      
      if (empSelect) empSelect.value = request.employee_id || '';
      if (dateInput) dateInput.value = request.work_date || '';
      if (endTimeInput) endTimeInput.value = request.end_time || '';
      if (reasonInput) reasonInput.value = request.reason || '';
      
      // Update modal title and button text
      const title = modal.querySelector('h5');
      const saveBtn = document.getElementById('ut-save');
      if (title) title.textContent = 'Edit Undertime Request';
      if (saveBtn) saveBtn.textContent = 'Update';
      
      // Store the request ID for updating
      modal.dataset.editingId = request.ut_id || request.id;
      
      modal.classList.remove('hidden');
    });
  }

  /**
   * DELETE UNDERTIME REQUEST
   * Removes undertime request from the system
   */
  async function deleteUndertimeRequest(request) {
    try {
      const fd = new FormData();
      fd.append('operation', 'deleteUndertime');
      fd.append('json', JSON.stringify({ ut_id: request.ut_id || request.id }));
      await axios.post(`${baseApiUrl}/undertime.php`, fd);
    } catch (error) {
      throw error;
    }
  }

  /**
   * ARCHIVE UNDERTIME REQUEST
   * Archives undertime request to archive storage
   */
  async function archiveUndertimeRequest(request) {
    try {
      const fd = new FormData();
      fd.append('operation', 'archiveUndertime');
      fd.append('json', JSON.stringify({ ut_id: request.ut_id || request.id }));
      await axios.post(`${baseApiUrl}/undertime.php`, fd);
    } catch (error) {
      throw error;
    }
  }

  /**
   * LOAD ARCHIVED UNDERTIME REQUESTS
   * Fetches archived undertime data from API
   */
  async function loadArchivedUndertime() {
    try {
      const res = await axios.get(`${baseApiUrl}/undertime.php`, { params: { operation: 'listArchived' } });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * RESTORE UNDERTIME REQUEST FROM ARCHIVE
   * Restores archived undertime request back to active status
   */
  async function restoreUndertimeRequest(request) {
    try {
      const fd = new FormData();
      fd.append('operation', 'restoreUndertime');
      fd.append('json', JSON.stringify({ ut_id: request.ut_id || request.id }));
      await axios.post(`${baseApiUrl}/undertime.php`, fd);
    } catch (error) {
      throw error;
    }
  }

  /**
   * OPEN VIEW MODAL FOR UNDERTIME REQUEST
   * Displays detailed view with approve/reject actions for pending requests
   */
  function openViewModal(request) {
    // Create or get existing modal
    let modal = document.getElementById('adminUtViewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminUtViewModal';
      modal.className = 'fixed inset-0 z-50 hidden';
      document.body.appendChild(modal);
    }

    const name = toTitleCase(`${request.first_name || ''} ${request.last_name || ''}`.trim());
    const dept = toTitleCase(getRowDept(request) || '');
    const isPending = String(request.status || '').toLowerCase() === 'pending';
    
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black/50" data-close="true"></div>
      <div class="relative mx-auto mt-24 w-full max-w-lg">
        <div class="bg-white rounded-lg shadow">
          <div class="flex items-center justify-between border-b px-4 py-3">
            <h5 class="font-semibold">Undertime Request Details</h5>
            <button class="text-gray-500 text-xl" data-close="true">×</button>
          </div>
          <div class="p-4 text-sm space-y-3">
            <div><span class="text-gray-500 font-medium">Employee:</span> <span class="ml-2">${escapeHtml(name)}</span></div>
            <div><span class="text-gray-500 font-medium">Department:</span> <span class="ml-2">${escapeHtml(dept)}</span></div>
            <div><span class="text-gray-500 font-medium">Date:</span> <span class="ml-2">${formatWorkDate(request.work_date)}</span></div>
            <div><span class="text-gray-500 font-medium">Time Out:</span> <span class="ml-2">${formatTime12(request.end_time)}</span></div>
            <div><span class="text-gray-500 font-medium">Hours:</span> <span class="ml-2">${request.hours || 'N/A'}</span></div>
            <div><span class="text-gray-500 font-medium">Status:</span> <span class="ml-2">${statusBadge(request.status)}</span></div>
            <div>
              <span class="text-gray-500 font-medium">Reason:</span>
              <div class="mt-1 p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">${escapeHtml(request.reason || 'No reason provided')}</div>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t px-4 py-3">
            <button class="px-3 py-2 text-sm rounded border" data-close="true">Close</button>
            ${isPending ? `
              <button id="modal-approve-btn" class="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
              <button id="modal-reject-btn" class="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700">Reject</button>
            ` : ''}
          </div>
        </div>
      </div>`;

    // Wire close buttons
    modal.querySelectorAll('[data-close="true"]').forEach(el => {
      el.addEventListener('click', () => modal.classList.add('hidden'));
    });

    // Wire approve/reject buttons if pending
    if (isPending) {
      const approveBtn = modal.querySelector('#modal-approve-btn');
      const rejectBtn = modal.querySelector('#modal-reject-btn');
      
      if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
          await submitDecision(request, 'approve');
          modal.classList.add('hidden');
          await loadUndertime();
          render();
          alert('Request approved successfully');
        });
      }
      
      if (rejectBtn) {
        rejectBtn.addEventListener('click', async () => {
          await submitDecision(request, 'reject');
          modal.classList.add('hidden');
          await loadUndertime();
          render();
          alert('Request rejected successfully');
        });
      }
    }

    modal.classList.remove('hidden');
  }

  /**
   * SHOW DROPDOWN MENU OUTSIDE TABLE CONTAINER
   * Creates dropdown menu positioned absolutely to avoid clipping
   */
  function showDropdownMenu(button, request) {
    // Remove any existing dropdown
    closeDropdownMenu();
    
    // Get button position
    const rect = button.getBoundingClientRect();
    
    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.id = 'ut-dropdown-menu';
    dropdown.className = 'fixed bg-white rounded-md shadow-xl border border-gray-200 z-[9999] min-w-[120px]';
    dropdown.style.left = `${rect.right - 120}px`; // Position to the left of button
    dropdown.style.top = `${rect.bottom + 4}px`; // Position below button
    
    const isPending = String(request.status || '').toLowerCase() === 'pending';
    
    dropdown.innerHTML = `
      <div class="py-1">
        <button class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors" data-menu-action="view">View</button>
        ${isPending ? `
          <button class="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors" data-menu-action="approve">Approve</button>
          <button class="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" data-menu-action="reject">Reject</button>
        ` : ''}
      </div>`;
    
    // Add to body
    document.body.appendChild(dropdown);
    
    // Wire menu actions
    dropdown.querySelectorAll('[data-menu-action]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const action = btn.getAttribute('data-menu-action');
        
        if (action === 'view') {
          openViewModal(request);
        } else if (action === 'approve') {
          await submitDecision(request, 'approve');
          await loadUndertime();
          render();
          alert('Request approved successfully');
        } else if (action === 'reject') {
          await submitDecision(request, 'reject');
          await loadUndertime();
          render();
          alert('Request rejected successfully');
        }
        
        closeDropdownMenu();
      });
    });
    
    // Adjust position if dropdown goes off screen
    const dropdownRect = dropdown.getBoundingClientRect();
    if (dropdownRect.right > window.innerWidth) {
      dropdown.style.left = `${rect.left - dropdownRect.width}px`;
    }
    if (dropdownRect.bottom > window.innerHeight) {
      dropdown.style.top = `${rect.top - dropdownRect.height - 4}px`;
    }
  }

  /**
   * CLOSE DROPDOWN MENU
   * Removes the dropdown menu from the DOM
   */
  function closeDropdownMenu() {
    const existing = document.getElementById('ut-dropdown-menu');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * OPEN ARCHIVE MODAL FOR UNDERTIME REQUESTS
   * Displays archived undertime requests with restore functionality
   */
  async function openArchiveModal() {
    try {
      const archivedRequests = await loadArchivedUndertime();
      
      // Create or get existing modal
      let modal = document.getElementById('adminUtArchiveModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'adminUtArchiveModal';
        modal.className = 'fixed inset-0 z-50 hidden';
        document.body.appendChild(modal);
      }

      let query = '';
      const renderArchiveTable = () => {
        const filtered = (!query ? archivedRequests : archivedRequests.filter(request => {
          const name = `${(request.first_name||'').toLowerCase()} ${(request.last_name||'').toLowerCase()}`.trim();
          const dept = String(getRowDept(request) || '').toLowerCase();
          const reason = String(request.reason || '').toLowerCase();
          const status = String(request.status || '').toLowerCase();
          return name.includes(query) || dept.includes(query) || reason.includes(query) || status.includes(query);
        }));

        const wrap = document.getElementById('archive-table-wrap');
        if (!wrap) return;
        
        if (!filtered.length) {
          wrap.innerHTML = '<div class="text-sm text-gray-500 text-center py-8">No archived undertime requests</div>';
          return;
        }

        const rowsHtml = filtered.map((request, idx) => {
          const name = toTitleCase(`${request.first_name || ''} ${request.last_name || ''}`.trim());
          const dept = toTitleCase(getRowDept(request) || '');
          return `
            <tr>
              <td class="px-3 py-2 text-sm text-gray-700">${idx + 1}</td>
              <td class="px-3 py-2 text-sm text-gray-700">${name}</td>
              <td class="px-3 py-2 text-sm text-gray-700">${dept}</td>
              <td class="px-3 py-2 text-sm text-gray-700">${formatWorkDate(request.work_date)}</td>
              <td class="px-3 py-2 text-sm text-gray-700">${formatTime12(request.end_time)}</td>
              <td class="px-3 py-2 text-sm text-gray-700">${statusBadge(request.status)}</td>
              <td class="px-3 py-2 text-sm text-right">
                <button class="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700" data-restore-id="${request.ut_id || request.id}">Restore</button>
              </td>
            </tr>`;
        }).join('');

        wrap.innerHTML = `
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">#</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Employee</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Department</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Time Out</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">${rowsHtml}</tbody>
          </table>`;

        // Wire restore buttons
        wrap.querySelectorAll('[data-restore-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const requestId = btn.getAttribute('data-restore-id');
            const request = filtered.find(r => String(r.ut_id || r.id) === requestId);
            if (!request) return;

            if (confirm('Are you sure you want to restore this undertime request?')) {
              try {
                await restoreUndertimeRequest(request);
                alert('Request restored successfully');
                // Refresh archive modal
                await openArchiveModal();
                // Refresh main list
                await loadUndertime();
                render();
              } catch {
                alert('Failed to restore request');
              }
            }
          });
        });
      };

      modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50" data-close="true"></div>
        <div class="relative mx-auto mt-20 w-full max-w-5xl">
          <div class="bg-white rounded-lg shadow max-h-[80vh] flex flex-col">
            <div class="flex items-center justify-between border-b px-4 py-3">
              <h5 class="font-semibold">Archived Undertime Requests (${archivedRequests.length})</h5>
              <button class="text-gray-500 hover:text-gray-700 text-xl leading-none" data-close="true">×</button>
            </div>
            <div class="p-4">
              <div class="mb-3 flex items-center gap-2">
                <div class="relative">
                  <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/></svg>
                  <input id="archive-search" class="w-64 border rounded pl-9 pr-3 py-1.5 text-sm" placeholder="Search archived requests..." />
                </div>
                <button id="archive-clear" class="text-xs text-gray-600 border rounded px-2 py-1">Clear</button>
              </div>
              <div id="archive-table-wrap" class="overflow-auto max-h-[50vh]"></div>
            </div>
            <div class="flex justify-end items-center gap-2 border-t px-4 py-3">
              <button id="ut-restore-all-btn" class="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Restore All</button>
              <button class="px-3 py-2 text-sm rounded border" data-close="true">Close</button>
            </div>
          </div>
        </div>`;

      // Wire close buttons
      modal.querySelectorAll('[data-close="true"]').forEach(el => {
        el.addEventListener('click', () => modal.classList.add('hidden'));
      });

      // Wire search functionality
      const searchInput = document.getElementById('archive-search');
      const clearBtn = document.getElementById('archive-clear');
      const restoreAllBtn = document.getElementById('ut-restore-all-btn');
      
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          query = (searchInput.value || '').trim().toLowerCase();
          renderArchiveTable();
        });
      }
      
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          query = '';
          renderArchiveTable();
        });
      }

      // Wire restore all button
      if (restoreAllBtn) {
        restoreAllBtn.addEventListener('click', async () => {
          if (archivedRequests.length === 0) {
            alert('No archived requests to restore');
            return;
          }
          
          if (confirm(`Are you sure you want to restore all ${archivedRequests.length} archived undertime request(s)?`)) {
            try {
              const promises = archivedRequests.map(request => restoreUndertimeRequest(request));
              await Promise.all(promises);
              alert(`${archivedRequests.length} request(s) restored successfully`);
              // Close archive modal and refresh main list
              modal.classList.add('hidden');
              await loadUndertime();
              render();
            } catch {
              alert('Failed to restore some requests');
            }
          }
        });
      }

      // Initial render
      renderArchiveTable();
      modal.classList.remove('hidden');

    } catch (error) {
      alert('Failed to load archived requests');
    }
  }

  // Make openArchiveModal globally available for the Archive button
  window.openUndertimeArchiveModal = openArchiveModal;

  async function init(){
    try {
      // Wire controls
      const searchInput = document.getElementById('ut-req-search-input');
      const pageSizeSelect = document.getElementById('ut-req-page-size');
      const statusSelect = document.getElementById('ut-req-status-filter');
      const deptSelect = document.getElementById('ut-req-dept-filter');

      if (searchInput) searchInput.addEventListener('input', () => { query = (searchInput.value || '').trim(); page = 1; render(); });
      if (pageSizeSelect) pageSizeSelect.addEventListener('change', () => {
        const n = Number(pageSizeSelect.value);
        pageSize = Number.isFinite(n) && n > 0 ? n : 10;
        page = 1;
        render();
      });
      if (statusSelect) statusSelect.addEventListener('change', () => {
        statusFilter = (statusSelect.value || 'pending').toLowerCase();
        page = 1;
        render();
      });
      if (deptSelect) deptSelect.addEventListener('change', () => {
        deptFilter = (deptSelect.value || '').toLowerCase();
        page = 1;
        render();
      });

      // Wire modal open/close and submit
      const openBtn = document.getElementById('ut-btn-file');
      const modal = document.getElementById('adminUtModal');
      const saveBtn = document.getElementById('ut-save');
      if (openBtn) openBtn.addEventListener('click', openUt);
      if (modal) modal.querySelectorAll('[data-close="true"]').forEach(el => el.addEventListener('click', closeUt));
      if (saveBtn) saveBtn.addEventListener('click', submitUndertime);

      await Promise.all([loadEmployees(), loadDepartments(), loadUndertime()]);
      // Ensure deterministic order (newest first)
      allItems = allItems.slice().sort((a,b) => String(b.work_date||'').localeCompare(String(a.work_date||'')));
      render();
    } catch {
      render();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
