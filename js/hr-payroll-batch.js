/**
 * HR PAYROLL BATCH FUNCTIONALITY
 * Handles payroll batch generation and management for HR users
 * Provides modal handling and form submission
 */

(function() {
  'use strict';

  /**
   * Initialize payroll batch functionality for HR
   * Sets up event listeners for the payroll batch UI
   */
  function initPayrollBatch() {
    try {
      // Get DOM elements
      const generateBtn = document.getElementById('btn-generate-batch');
      const modal = document.getElementById('generateBatchModal');
      const closeButtons = modal ? modal.querySelectorAll('[data-close]') : [];
      const generateFormBtn = document.getElementById('batch-generate');
      
      // Check if we're on the payroll batch page
      if (!generateBtn || !modal) {
        console.log('HR Payroll batch elements not found, not initializing');
        return;
      }
      
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
      
      // Close modal when clicking outside
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
      
      // Generate batch form submission
      if (generateFormBtn) {
        generateFormBtn.addEventListener('click', function() {
          handleBatchGeneration();
        });
      }
      
      console.log('HR Payroll batch functionality initialized');
    } catch (error) {
      console.error('Error initializing HR payroll batch functionality:', error);
    }
  }
  
  /**
   * Populate departments dropdown for HR
   * Fetches all departments and populates the dropdown
   */
  function populateDepartments() {
    try {
      const departmentSelect = document.getElementById('batch-department');
      if (!departmentSelect) return;
      
      // Clear existing options except the first one
      while (departmentSelect.options.length > 1) {
        departmentSelect.remove(1);
      }
      
      // Show loading state
      const loadingOption = document.createElement('option');
      loadingOption.value = '';
      loadingOption.textContent = 'Loading departments...';
      loadingOption.disabled = true;
      departmentSelect.appendChild(loadingOption);
      
      // Fetch departments from API
      axios.get('../../api/employees.php?operation=getDepartments')
        .then(response => {
          const departments = response.data;
          // Clear loading option
          departmentSelect.innerHTML = '<option value="">All Departments</option>';
          
          if (Array.isArray(departments) && departments.length > 0) {
            departments.forEach(dept => {
              const option = document.createElement('option');
              // The API returns an array of strings, not objects
              if (typeof dept === 'string') {
                option.value = dept;
                option.textContent = dept;
              } else if (dept.dept_name) {
                // Fallback for object format
                option.value = dept.dept_name;
                option.textContent = dept.dept_name;
              }
              departmentSelect.appendChild(option);
            });
            
            // Force re-render of the select element
            departmentSelect.dispatchEvent(new Event('change'));
          }
        })
        .catch(error => {
          console.error('Error fetching departments:', error);
          // Clear loading option and show error
          departmentSelect.innerHTML = '<option value="">All Departments</option>';
          const errorOption = document.createElement('option');
          errorOption.value = '';
          errorOption.textContent = 'Error loading departments';
          errorOption.disabled = true;
          departmentSelect.appendChild(errorOption);
          
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load departments. Please try again.',
            confirmButtonText: 'OK'
          });
        });
    } catch (error) {
      console.error('Error populating departments:', error);
    }
  }
  
  /**
   * Handle batch generation form submission for HR
   * Processes the form data and generates a payroll batch
   */
  function handleBatchGeneration() {
    try {
      // Get form data
      const batchName = document.getElementById('batch-name').value;
      const periodStart = document.getElementById('batch-period-start').value;
      const periodEnd = document.getElementById('batch-period-end').value;
      const department = document.getElementById('batch-department').value;
      const notesEl = document.getElementById('batch-notes');
      const notes = notesEl ? notesEl.value : '';
      
      // Simple validation
      if (!batchName) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please enter a batch name',
          confirmButtonText: 'OK'
        });
        return;
      }
      
      if (!periodStart || !periodEnd) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please select both start and end dates',
          confirmButtonText: 'OK'
        });
        return;
      }
      
      // In a real implementation, this would submit to an API
      // For now, we'll just show a success message
      Swal.fire({
        icon: 'success',
        title: 'Batch Generated',
        text: 'Payroll batch has been generated successfully!',
        confirmButtonText: 'OK'
      });
      
      // Close the modal
      document.getElementById('generateBatchModal').classList.add('hidden');
      
      // Reset form
      document.getElementById('batch-name').value = '';
      document.getElementById('batch-period-start').value = '';
      document.getElementById('batch-period-end').value = '';
      document.getElementById('batch-department').value = '';
      const notesEl2 = document.getElementById('batch-notes');
      if (notesEl2) notesEl2.value = '';
      
      console.log('HR Batch generated with data:', { batchName, periodStart, periodEnd, department, notes });
    } catch (error) {
      console.error('Error handling HR batch generation:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to generate payroll batch. Please try again.',
        confirmButtonText: 'OK'
      });
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