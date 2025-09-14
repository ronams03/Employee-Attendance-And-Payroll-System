# Employee-Attendance-and-Payroll-System2.0

## Recent Updates & Fixes

### Leave Request Management System - Enhanced
- **Fixed Leave Request View Modal**: Added Approve and Reject buttons directly in the view modal for pending requests
- **Enhanced User Interface**: 
  - Added visual icons (checkmark for approve, X for reject) to action buttons
  - Improved button styling with green/red color coding
  - Enhanced success/error notifications using SweetAlert2 with fallback support
- **Smart Button Display**: Approve/Reject buttons only appear for pending requests in the view modal
- **Maintained Existing Functionality**: All existing features (dropdown actions, search, filtering, pagination) remain intact

### Overtime Request System - Fixed
- **Request Submission**: Fixed overtime request submission functionality
- **Employee Selection**: Improved employee search and selection in overtime request forms
- **Validation**: Enhanced form validation for hours, dates, and employee selection
- **Status Management**: Fixed approval/rejection workflow for overtime requests

### Undertime Request System - Fixed  
- **Request Submission**: Fixed undertime request submission functionality
- **Employee Selection**: Improved employee search and selection in undertime request forms
- **Validation**: Enhanced form validation for hours, dates, and employee selection
- **Status Management**: Fixed approval/rejection workflow for undertime requests

### General Improvements
- **Modal Functionality**: Enhanced modal close/open behavior across all request types
- **Form Validation**: Improved client-side validation for all request forms
- **Error Handling**: Better error handling and user feedback throughout the system
- **UI/UX Consistency**: Standardized button styles and interactions across all modules

---

## System Overview

This is a comprehensive Employee Attendance and Payroll Management System designed to streamline HR operations and employee management processes.

### Key Features

#### Employee Management
- Employee registration and profile management
- Department and position management
- Employee search and filtering capabilities

#### Attendance Management
- Real-time attendance tracking
- Clock in/out functionality
- Attendance reports and analytics
- Overtime and undertime tracking

#### Leave Management
- Leave request submission and approval workflow
- Multiple leave types support
- Leave balance tracking
- Calendar integration for leave planning

#### Request Management
- Overtime request system with approval workflow
- Undertime request system with approval workflow
- Leave request system with multi-level approval
- Request status tracking and notifications

#### Payroll Management
- Automated payroll calculation
- Deduction and bonus management
- Payslip generation
- Batch payroll processing

#### Reporting & Analytics
- Comprehensive attendance reports
- Payroll reports
- Employee performance analytics
- Export capabilities (PDF, Excel)

### Technical Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Tailwind CSS
- **Backend**: PHP
- **Database**: MySQL
- **Libraries**: 
  - Axios for HTTP requests
  - SweetAlert2 for notifications
  - Chart.js for analytics
  - PHPMailer for email notifications

### Installation & Setup
1. Clone the repository to your web server directory
2. Import the database schema from `database.sql`
3. Configure database connection settings
4. Set up email configuration for notifications
5. Access the system through your web browser

### User Roles
- **Admin**: Full system access and management
- **HR**: Employee and payroll management
- **Manager**: Team management and approval workflows
- **Employee**: Personal attendance and request management

### Security Features
- Session management and timeout
- Role-based access control
- Input validation and sanitization
- Secure password handling
- Activity logging and audit trails