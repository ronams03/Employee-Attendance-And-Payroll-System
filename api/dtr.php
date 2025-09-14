<?php
/**
 * DTR (Daily Time Record) API Endpoint
 * Handles DTR data retrieval and management for admin dashboard
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include 'connection-pdo.php';

function getEmployeeDTR($employee_id, $start_date, $end_date) {
    global $conn;
    
    // Get employee info
    $empStmt = $conn->prepare("
        SELECT e.*, CONCAT(e.first_name, ' ', e.last_name) as full_name 
        FROM tblemployees e 
        WHERE e.employee_id = ?
    ");
    $empStmt->execute([$employee_id]);
    $employee = $empStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$employee) {
        return ['error' => 'Employee not found'];
    }
    
    // Get attendance records
    $stmt = $conn->prepare("
        SELECT 
            a.*,
            a.attendance_date,
            a.time_in as time_in_only,
            a.time_out as time_out_only,
            CASE 
                WHEN a.time_out IS NOT NULL THEN 
                    TIMESTAMPDIFF(MINUTE, a.time_in, a.time_out) / 60.0
                ELSE 0 
            END as hours_worked,
            CASE 
                WHEN a.time_in > '08:00:00' THEN 
                    TIMESTAMPDIFF(MINUTE, '08:00:00', a.time_in) / 60.0
                ELSE 0 
            END as late_hours,
            CASE 
                WHEN a.time_out IS NOT NULL AND a.time_out < '17:00:00' THEN 
                    TIMESTAMPDIFF(MINUTE, a.time_out, '17:00:00') / 60.0
                ELSE 0 
            END as undertime_hours
        FROM tblattendance a 
        WHERE a.employee_id = ? 
        AND a.attendance_date BETWEEN ? AND ?
        ORDER BY a.attendance_date DESC
    ");
    
    $stmt->execute([$employee_id, $start_date, $end_date]);
    $attendance = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get overtime records
    $otStmt = $conn->prepare("
        SELECT 
            ot.*,
            ot.work_date as overtime_date
        FROM tblovertime_requests ot 
        WHERE ot.employee_id = ? 
        AND ot.work_date BETWEEN ? AND ?
        AND ot.status = 'approved'
        ORDER BY ot.work_date DESC
    ");
    
    $otStmt->execute([$employee_id, $start_date, $end_date]);
    $overtime = $otStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate summary statistics
    $total_hours = array_sum(array_column($attendance, 'hours_worked'));
    $total_late_hours = array_sum(array_column($attendance, 'late_hours'));
    $total_undertime_hours = array_sum(array_column($attendance, 'undertime_hours'));
    $total_overtime_hours = array_sum(array_column($overtime, 'hours'));
    $days_present = count($attendance);
    
    // Calculate expected working days (Monday to Friday)
    $expected_days = 0;
    $current = new DateTime($start_date);
    $end = new DateTime($end_date);
    
    while ($current <= $end) {
        $dayOfWeek = $current->format('N'); // 1 = Monday, 7 = Sunday
        if ($dayOfWeek >= 1 && $dayOfWeek <= 5) { // Monday to Friday
            $expected_days++;
        }
        $current->add(new DateInterval('P1D'));
    }
    
    $days_absent = max(0, $expected_days - $days_present);
    
    return [
        'employee' => $employee,
        'attendance' => $attendance,
        'overtime' => $overtime,
        'summary' => [
            'total_hours' => round($total_hours, 2),
            'total_late_hours' => round($total_late_hours, 2),
            'total_undertime_hours' => round($total_undertime_hours, 2),
            'total_overtime_hours' => round($total_overtime_hours, 2),
            'days_present' => $days_present,
            'days_absent' => $days_absent,
            'expected_days' => $expected_days
        ],
        'period' => [
            'start_date' => $start_date,
            'end_date' => $end_date
        ]
    ];
}

// Handle requests
$operation = $_GET['operation'] ?? $_POST['operation'] ?? '';

switch ($operation) {
    case 'getDTR':
        $employee_id = $_GET['employee_id'] ?? '';
        $start_date = $_GET['start_date'] ?? '';
        $end_date = $_GET['end_date'] ?? '';
        
        if (!$employee_id || !$start_date || !$end_date) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required parameters']);
            exit;
        }
        
        $result = getEmployeeDTR($employee_id, $start_date, $end_date);
        
        if (isset($result['error'])) {
            http_response_code(404);
            echo json_encode($result);
        } else {
            echo json_encode($result);
        }
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid operation']);
        break;
}
?>
