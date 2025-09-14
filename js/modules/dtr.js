/**
 * DTR (Daily Time Record) Module
 * Handles DTR viewing functionality for admin dashboard
 */

/**
 * Open DTR modal for a specific employee
 * @param {number} employeeId - The employee ID
 */
export async function openEmployeeDTR(employeeId) {
    try {
        await ensureSweetAlertAssets();
        
        // Create or get existing modal
        let modal = document.getElementById('dtrModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dtrModal';
            modal.className = 'fixed inset-0 z-50 hidden';
            document.body.appendChild(modal);
        }

        // Set initial loading state
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50" data-close="true"></div>
            <div class="relative mx-auto mt-10 w-full max-w-6xl">
                <div class="bg-white rounded-lg shadow max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between border-b px-6 py-4">
                        <h5 class="text-lg font-semibold">Employee DTR - Loading...</h5>
                        <button class="text-gray-500 hover:text-gray-700 text-xl leading-none" data-close="true">×</button>
                    </div>
                    <div class="p-6 flex-1 overflow-y-auto">
                        <div class="flex items-center justify-center py-12">
                            <div class="text-gray-500">Loading DTR data...</div>
                        </div>
                    </div>
                </div>
            </div>`;

        // Show modal
        modal.classList.remove('hidden');

        // Wire close buttons
        modal.querySelectorAll('[data-close="true"]').forEach(el => {
            el.addEventListener('click', () => modal.classList.add('hidden'));
        });

        // Load and render DTR data
        await renderDTRContent(modal, employeeId);

    } catch (error) {
        console.error('Error opening DTR modal:', error);
        showToast('Failed to load DTR data', 'error');
    }
}

/**
 * Render DTR content in the modal
 */
async function renderDTRContent(modal, employeeId) {
    try {
        // Default to current week for initial load
        const dates = calculatePeriodDates('current-week');
        const defaultStartDate = dates.start;
        const defaultEndDate = dates.end;

        // Load initial DTR data
        const dtrData = await loadDTRData(employeeId, defaultStartDate, defaultEndDate);
        
        if (!dtrData || dtrData.error) {
            modal.querySelector('.bg-white').innerHTML = `
                <div class="flex items-center justify-between border-b px-6 py-4">
                    <h5 class="text-lg font-semibold">Employee DTR - Error</h5>
                    <button class="text-gray-500 hover:text-gray-700 text-xl leading-none" data-close="true">×</button>
                </div>
                <div class="p-6">
                    <div class="text-center py-12">
                        <div class="text-red-600">Error: ${dtrData?.error || 'Failed to load DTR data'}</div>
                    </div>
                </div>`;
            return;
        }

        // Render the full DTR interface with weekly view as default
        renderDTRInterface(modal, employeeId, dtrData, defaultStartDate, defaultEndDate, 'current-week');

    } catch (error) {
        console.error('Error rendering DTR content:', error);
        modal.querySelector('.bg-white').innerHTML = `
            <div class="flex items-center justify-between border-b px-6 py-4">
                <h5 class="text-lg font-semibold">Employee DTR - Error</h5>
                <button class="text-gray-500 hover:text-gray-700 text-xl leading-none" data-close="true">×</button>
            </div>
            <div class="p-6">
                <div class="text-center py-12">
                    <div class="text-red-600">Failed to load DTR data</div>
                </div>
            </div>`;
    }
}

/**
 * Render the complete DTR interface
 */
function renderDTRInterface(modal, employeeId, dtrData, currentStartDate, currentEndDate, periodType = 'current-week') {
    const employee = dtrData.employee;
    const summary = dtrData.summary;
    
    // Format period for display
    const startDate = new Date(currentStartDate);
    const endDate = new Date(currentEndDate);
    const periodDisplay = `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    
    modal.querySelector('.bg-white').innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible">
            <!-- Header -->
            <div class="flex justify-between items-center p-6 border-b border-gray-200 print:hidden">
                <h2 class="text-xl font-semibold text-gray-900">Daily Time Record</h2>
                <div class="flex space-x-2">
                    <button id="print-dtr" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                        Print DTR
                    </button>
                    <button id="close-dtr-modal" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6 print:p-4">
                <!-- Period Selection -->
                <div class="mb-6 flex flex-wrap items-center gap-4 print:hidden">
                    <div class="flex items-center space-x-2">
                        <label for="dtr-period" class="text-sm font-medium text-gray-700">Period:</label>
                        <select id="dtr-period" class="border border-gray-300 rounded-md px-3 py-1 text-sm">
                            <option value="current-week" ${periodType === 'current-week' ? 'selected' : ''}>Current Week</option>
                            <option value="current-month" ${periodType === 'current-month' ? 'selected' : ''}>Current Month</option>
                            <option value="custom" ${periodType === 'custom' ? 'selected' : ''}>Custom Range</option>
                        </select>
                    </div>
                    <div id="custom-date-range" class="hidden flex items-center space-x-2">
                        <input type="date" id="dtr-start-date" class="border border-gray-300 rounded-md px-3 py-1 text-sm">
                        <span class="text-sm text-gray-500">to</span>
                        <input type="date" id="dtr-end-date" class="border border-gray-300 rounded-md px-3 py-1 text-sm">
                    </div>
                    <button id="load-dtr-data" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                        Load Data
                    </button>
                </div>

                <!-- DTR Form -->
                <div id="dtr-content" class="bg-white print:bg-white">
                    <div class="text-center mb-6">
                        <div class="text-lg font-bold mb-2">DAILY TIME RECORD</div>
                        <div class="text-sm">Civil Service Form No. 48</div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-8 mb-6 text-sm">
                        <div>
                            <div class="mb-2">
                                <span class="font-semibold">Name:</span> 
                                <span class="border-b border-black inline-block w-48 ml-2">${employee.full_name || ''}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Department:</span> 
                                <span class="border-b border-black inline-block w-48 ml-2">${employee.department || ''}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Position:</span> 
                                <span class="border-b border-black inline-block w-48 ml-2">${employee.position || ''}</span>
                            </div>
                        </div>
                        <div>
                            <div class="mb-2">
                                <span class="font-semibold">Employee ID:</span> 
                                <span class="border-b border-black inline-block w-32 ml-2">${employee.employee_id || ''}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Period:</span> 
                                <span class="border-b border-black inline-block w-48 ml-2">${periodDisplay}</span>
                            </div>
                        </div>
                    </div>

                    <!-- DTR Table -->
                    <div id="dtr-table-container">
                        ${renderDTRTable(dtrData.attendance, dtrData.overtime, currentStartDate, currentEndDate, periodType)}
                    </div>

                    <!-- Summary Section -->
                    <div class="mt-6 grid grid-cols-2 gap-8 text-sm">
                        <div>
                            <div class="mb-2">
                                <span class="font-semibold">Total Days Present:</span> 
                                <span class="border-b border-black inline-block w-16 ml-2 text-center">${summary.days_present}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Total Days Absent:</span> 
                                <span class="border-b border-black inline-block w-16 ml-2 text-center">${summary.days_absent}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Total Hours Worked:</span> 
                                <span class="border-b border-black inline-block w-20 ml-2 text-center">${parseFloat(summary.total_hours || 0).toFixed(1)}</span>
                            </div>
                        </div>
                        <div>
                            <div class="mb-2">
                                <span class="font-semibold">Total Late Hours:</span> 
                                <span class="border-b border-black inline-block w-20 ml-2 text-center">${parseFloat(summary.total_late_hours || 0).toFixed(1)}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Total Overtime Hours:</span> 
                                <span class="border-b border-black inline-block w-20 ml-2 text-center">${parseFloat(summary.total_overtime_hours || 0).toFixed(1)}</span>
                            </div>
                            <div class="mb-2">
                                <span class="font-semibold">Total Undertime Hours:</span> 
                                <span class="border-b border-black inline-block w-20 ml-2 text-center">${parseFloat(summary.total_undertime_hours || 0).toFixed(1)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Signature Section -->
                    <div class="mt-8 grid grid-cols-2 gap-8 text-sm">
                        <div>
                            <div class="mb-4">
                                <div class="font-semibold mb-2">I CERTIFY on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.</div>
                            </div>
                            <div class="text-center">
                                <div class="border-b border-black inline-block w-48 mb-2"></div>
                                <div class="text-xs">Signature of Employee</div>
                            </div>
                        </div>
                        <div>
                            <div class="mb-4">
                                <div class="font-semibold mb-2">VERIFIED as to the prescribed office hours:</div>
                            </div>
                            <div class="text-center">
                                <div class="border-b border-black inline-block w-48 mb-2"></div>
                                <div class="text-xs">In Charge</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Wire event handlers
    wireDTREventHandlers(modal, employeeId);
}

/**
 * Render DTR table based on period type (weekly vs monthly)
 */
function renderDTRTable(attendance, overtime, startDate, endDate, periodType = 'current-week') {
    if (periodType === 'current-week') {
        return renderWeeklyDTRTable(attendance, overtime, startDate, endDate);
    } else {
        return renderMonthlyDTRTable(attendance, overtime, startDate, endDate);
    }
}

/**
 * Render weekly DTR table with detailed daily view
 */
function renderWeeklyDTRTable(attendance, overtime, startDate, endDate) {
    // Generate all dates in the period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allDates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
    }

    // Create attendance map for quick lookup
    const attendanceMap = {};
    if (attendance) {
        attendance.forEach(record => {
            attendanceMap[record.attendance_date] = record;
        });
    }

    // Create overtime map for quick lookup
    const overtimeMap = {};
    if (overtime) {
        overtime.forEach(ot => {
            overtimeMap[ot.overtime_date || ot.work_date] = ot;
        });
    }

    if (allDates.length === 0) {
        return `
            <div class="p-8 text-center text-gray-500">
                No dates found for the selected period.
            </div>`;
    }

    const rows = allDates.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const record = attendanceMap[dateStr];
        const overtimeRecord = overtimeMap[dateStr];
        
        // Format date display
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Time formatting
        const formatTime = (timeStr) => {
            if (!timeStr) return '';
            try {
                const time = new Date(`2000-01-01T${timeStr}`);
                return time.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                });
            } catch {
                return timeStr;
            }
        };

        const timeIn = record ? formatTime(record.time_in_only) : '';
        const timeOut = record ? formatTime(record.time_out_only) : '';
        const hoursWorked = record ? parseFloat(record.hours_worked || 0).toFixed(1) : '';
        const lateHours = record ? parseFloat(record.late_hours || 0).toFixed(1) : '';
        const undertimeHours = record ? parseFloat(record.undertime_hours || 0).toFixed(1) : '';
        const overtimeHours = overtimeRecord ? parseFloat(overtimeRecord.hours || 0).toFixed(1) : '';
        
        const rowClass = isWeekend ? 'bg-gray-100' : '';
        const textClass = isWeekend ? 'text-gray-500' : '';

        return `
            <tr class="border-b border-gray-300 ${rowClass}">
                <td class="border-r border-gray-300 px-3 py-2 text-sm ${textClass}">${dayName}</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm ${textClass}">${dateDisplay}</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm text-center">${timeIn}</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm text-center">${timeOut}</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm text-center">${hoursWorked}h</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm text-center ${parseFloat(lateHours) > 0 ? 'text-red-600' : ''}">${lateHours}h</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm text-center ${parseFloat(undertimeHours) > 0 ? 'text-orange-600' : ''}">${undertimeHours}h</td>
                <td class="border-r border-gray-300 px-3 py-2 text-sm text-center ${parseFloat(overtimeHours) > 0 ? 'text-green-600' : ''}">${overtimeHours}h</td>
                <td class="px-3 py-2 text-sm text-center"></td>
            </tr>`;
    }).join('');

    return `
        <div class="mb-4">
            <h3 class="text-lg font-semibold mb-2">Weekly Time Record</h3>
        </div>
        <table class="w-full border border-gray-300 text-sm">
            <thead class="bg-gray-50">
                <tr class="border-b border-gray-300">
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-left">Day</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-left">Date</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-center">Time In</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-center">Time Out</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-center">Hours</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-center">Late</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-center">Undertime</th>
                    <th class="border-r border-gray-300 px-3 py-2 text-xs font-bold text-center">Overtime</th>
                    <th class="px-3 py-2 text-xs font-bold text-center">Remarks</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>`;
}

/**
 * Render monthly DTR table with traditional form layout
 */
function renderMonthlyDTRTable(attendance, overtime, startDate, endDate) {
    // Generate all dates in the period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allDates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
    }

    // Create attendance map for quick lookup
    const attendanceMap = {};
    if (attendance) {
        attendance.forEach(record => {
            attendanceMap[record.attendance_date] = record;
        });
    }

    // Create overtime map for quick lookup
    const overtimeMap = {};
    if (overtime) {
        overtime.forEach(ot => {
            overtimeMap[ot.overtime_date || ot.work_date] = ot;
        });
    }

    if (allDates.length === 0) {
        return `
            <div class="p-8 text-center text-gray-500">
                No dates found for the selected period.
            </div>`;
    }

    const rows = allDates.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const record = attendanceMap[dateStr];
        const overtimeRecord = overtimeMap[dateStr];
        
        // Format date display
        const dayNum = date.getDate();
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Time formatting for AM/PM split
        const formatTimeForAMPM = (timeStr, period) => {
            if (!timeStr) return '';
            try {
                const time = new Date(`2000-01-01T${timeStr}`);
                const hour = time.getHours();
                
                if (period === 'AM' && hour < 12) {
                    return time.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                    });
                } else if (period === 'PM' && hour >= 12) {
                    return time.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                    });
                }
                return '';
            } catch {
                return '';
            }
        };

        const timeInAM = record ? formatTimeForAMPM(record.time_in_only, 'AM') : '';
        const timeInPM = record ? formatTimeForAMPM(record.time_in_only, 'PM') : '';
        const timeOutAM = record ? formatTimeForAMPM(record.time_out_only, 'AM') : '';
        const timeOutPM = record ? formatTimeForAMPM(record.time_out_only, 'PM') : '';
        const hoursWorked = record ? parseFloat(record.hours_worked || 0).toFixed(1) : '';
        const overtimeHours = overtimeRecord ? parseFloat(overtimeRecord.hours || 0).toFixed(1) : '';
        
        const rowClass = isWeekend ? 'bg-gray-100' : '';
        const textClass = isWeekend ? 'text-gray-500' : '';

        return `
            <tr class="border-b border-black ${rowClass}">
                <td class="border-r border-black px-2 py-1 text-center text-xs ${textClass}">${dayNum}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs ${textClass}">${dayName}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs">${timeInAM}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs">${timeInPM}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs">${timeOutAM}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs">${timeOutPM}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs">${hoursWorked}</td>
                <td class="border-r border-black px-2 py-1 text-center text-xs">${overtimeHours}</td>
                <td class="px-2 py-1 text-center text-xs"></td>
            </tr>`;
    }).join('');

    return `
        <div class="mb-4">
            <h3 class="text-lg font-semibold mb-2">Monthly Time Record - Civil Service Form No. 48</h3>
        </div>
        <table class="w-full border-2 border-black text-sm">
            <thead>
                <tr class="border-b-2 border-black">
                    <th rowspan="2" class="border-r border-black px-2 py-2 text-xs font-bold">Day</th>
                    <th rowspan="2" class="border-r border-black px-2 py-2 text-xs font-bold">Date</th>
                    <th colspan="2" class="border-r border-black px-2 py-1 text-xs font-bold">ARRIVAL</th>
                    <th colspan="2" class="border-r border-black px-2 py-1 text-xs font-bold">DEPARTURE</th>
                    <th rowspan="2" class="border-r border-black px-2 py-2 text-xs font-bold">Hours<br/>Worked</th>
                    <th rowspan="2" class="border-r border-black px-2 py-2 text-xs font-bold">Overtime</th>
                    <th rowspan="2" class="px-2 py-2 text-xs font-bold">Remarks</th>
                </tr>
                <tr class="border-b border-black">
                    <th class="border-r border-black px-2 py-1 text-xs font-bold">A.M.</th>
                    <th class="border-r border-black px-2 py-1 text-xs font-bold">P.M.</th>
                    <th class="border-r border-black px-2 py-1 text-xs font-bold">A.M.</th>
                    <th class="border-r border-black px-2 py-1 text-xs font-bold">P.M.</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>`;
}

/**
 * Wire event handlers for DTR modal
 */
function wireDTREventHandlers(modal, employeeId) {
    // Close button handlers
    modal.querySelectorAll('[data-close="true"]').forEach(el => {
        el.addEventListener('click', () => modal.classList.add('hidden'));
    });

    // Close modal button
    const closeBtn = modal.querySelector('#close-dtr-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    // Period selection change handler
    const periodSelect = modal.querySelector('#dtr-period');
    const customDateRange = modal.querySelector('#custom-date-range');
    const startDateInput = modal.querySelector('#dtr-start-date');
    const endDateInput = modal.querySelector('#dtr-end-date');
    
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            const periodType = periodSelect.value;
            
            if (periodType === 'custom') {
                customDateRange?.classList.remove('hidden');
            } else {
                customDateRange?.classList.add('hidden');
                const dates = calculatePeriodDates(periodType);
                if (dates && startDateInput && endDateInput) {
                    startDateInput.value = dates.start;
                    endDateInput.value = dates.end;
                }
                
                // Auto-reload data when period changes
                const loadBtn = modal.querySelector('#load-dtr-data');
                if (loadBtn && dates) {
                    loadBtn.click();
                }
            }
        });
    }

    // Load DTR data button handler
    const loadBtn = modal.querySelector('#load-dtr-data');
    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            const startDate = startDateInput?.value;
            const endDate = endDateInput?.value;
            
            if (!startDate || !endDate) {
                showToast('Please select both start and end dates', 'error');
                return;
            }
            
            if (new Date(startDate) > new Date(endDate)) {
                showToast('Start date must be before end date', 'error');
                return;
            }

            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';
            
            try {
                const dtrData = await loadDTRData(employeeId, startDate, endDate);
                
                if (dtrData && !dtrData.error) {
                    renderDTRInterface(modal, employeeId, dtrData, startDate, endDate, periodType);
                } else {
                    showToast(dtrData?.error || 'Failed to load DTR data', 'error');
                }
            } catch (error) {
                console.error('Error loading DTR data:', error);
                showToast('Failed to load DTR data', 'error');
            } finally {
                loadBtn.disabled = false;
                loadBtn.textContent = 'Load Data';
            }
        });
    }

    // Print DTR button handler
    const printBtn = modal.querySelector('#print-dtr');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

/**
 * Calculate date ranges for different period types
 */
function calculatePeriodDates(periodType) {
    const now = new Date();
    
    switch (periodType) {
        case 'current-week':
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
            
            return {
                start: startOfWeek.toISOString().split('T')[0],
                end: endOfWeek.toISOString().split('T')[0]
            };
            
        case 'current-month':
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            return {
                start: startOfMonth.toISOString().split('T')[0],
                end: endOfMonth.toISOString().split('T')[0]
            };
            
        case 'last-month':
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            
            return {
                start: startOfLastMonth.toISOString().split('T')[0],
                end: endOfLastMonth.toISOString().split('T')[0]
            };
            
        default:
            return null;
    }
}

/**
 * Load DTR data from API
 */
async function loadDTRData(employeeId, startDate, endDate) {
    try {
        const response = await axios.get(`${window.baseApiUrl}/dtr.php`, {
            params: {
                operation: 'getDTR',
                employee_id: employeeId,
                start_date: startDate,
                end_date: endDate
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('Error loading DTR data:', error);
        throw error;
    }
}

/**
 * Ensure SweetAlert2 assets are loaded
 */
async function ensureSweetAlertAssets() {
    if (!window.__swalReady) {
        await new Promise((resolve) => {
            let pending = 0;
            const done = () => { if (--pending <= 0) resolve(); };
            
            if (!document.getElementById('swal2-css')) {
                pending++;
                const link = document.createElement('link');
                link.id = 'swal2-css';
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css';
                link.onload = done;
                link.onerror = done;
                document.head.appendChild(link);
            }
            
            if (!window.Swal) {
                pending++;
                const script = document.createElement('script');
                script.id = 'swal2-js';
                script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
                script.onload = done;
                script.onerror = done;
                document.head.appendChild(script);
            }
            
            if (pending === 0) resolve();
        });
        
        window.__swalReady = true;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}
