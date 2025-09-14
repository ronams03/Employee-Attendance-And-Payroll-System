<?php
  header('Content-Type: application/json');
  header('Access-Control-Allow-Origin: *');
  if (session_status() === PHP_SESSION_NONE) { session_start(); }

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
  }

  include 'connection-pdo.php';
  // Ensure server time uses local timezone for overtime window checks
  date_default_timezone_set('Asia/Manila');

  $operation = '';
  $json = '';
  if ($_SERVER['REQUEST_METHOD'] == 'GET'){
    $operation = isset($_GET['operation']) ? $_GET['operation'] : '';
  } else if($_SERVER['REQUEST_METHOD'] == 'POST'){
    $operation = isset($_POST['operation']) ? $_POST['operation'] : '';
    $json = isset($_POST['json']) ? $_POST['json'] : '';
  }

  switch ($operation) {
    case 'requestOvertime':
      echo requestOvertime($conn, $json);
      break;
    case 'updateOvertime':
      echo updateOvertime($conn, $json);
      break;
    case 'listByEmployee':
      echo listByEmployee($conn);
      break;
    case 'listPending':
      echo listPending($conn);
      break;
    case 'approve':
      echo setStatus($conn, $json, 'approved');
      break;
    case 'reject':
      echo setStatus($conn, $json, 'rejected');
      break;
    case 'listApproved':
      echo listApproved($conn);
      break;
    case 'listAll':
      echo listAll($conn);
      break;
    case 'logScan':
      echo logScan($conn, $json);
      break;
    case 'archiveOvertime':
      echo archiveOvertime($conn, $json);
      break;
    case 'listArchived':
      echo listArchived($conn);
      break;
    case 'restoreOvertime':
      echo restoreOvertime($conn, $json);
      break;
    default:
      echo json_encode([]);
  }

  /**
   * SUBMIT OVERTIME REQUEST
   * Creates new overtime request with employee ID resolution
   * Supports QR-based time tracking for accurate hours calculation
   */
  function requestOvertime($conn, $json){
    $data = json_decode($json, true);
    $employee_id = isset($data['employee_id']) ? intval($data['employee_id']) : 0;
    if ($employee_id <= 0 && isset($_SESSION['user_id'])){
      $u = $conn->prepare('SELECT employee_id FROM tblusers WHERE user_id = :id LIMIT 1');
      $u->bindParam(':id', $_SESSION['user_id'], PDO::PARAM_INT);
      $u->execute();
      $row = $u->fetch(PDO::FETCH_ASSOC);
      if ($row && intval($row['employee_id']) > 0){ $employee_id = intval($row['employee_id']); }
    }
    $work_date = isset($data['work_date']) ? trim($data['work_date']) : '';
    // QR-only for time in/out; accept requested hours for display/estimation
    $start_time = null;
    $end_time = null;
    $hours = isset($data['hours']) ? (float)$data['hours'] : null;
    $reason = isset($data['reason']) ? trim($data['reason']) : null;

    if ($employee_id <= 0 || $work_date === ''){
      return json_encode(['success' => 0, 'message' => 'Invalid inputs']);
    }

    // Compute hours if not provided but start/end times are given
    if (($hours === null || $hours <= 0) && $start_time && $end_time) {
      try {
        $st = new DateTime($work_date . ' ' . $start_time);
        $et = new DateTime($work_date . ' ' . $end_time);
        if ($et < $st) { $et->modify('+1 day'); }
        $diff = $et->getTimestamp() - $st->getTimestamp();
        if ($diff > 0) { $hours = round($diff / 3600, 2); }
      } catch (Exception $e) {}
    }

    $sql = "INSERT INTO tblovertime_requests (employee_id, work_date, start_time, end_time, hours, reason, status)
            VALUES (:eid, :d, :st, :et, :h, :r, 'pending')";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $stmt->bindParam(':d', $work_date);
    $stmt->bindParam(':st', $start_time);
    $stmt->bindParam(':et', $end_time);
    if ($hours !== null) { $stmt->bindParam(':h', $hours); } else { $null = null; $stmt->bindParam(':h', $null, PDO::PARAM_NULL); }
    $stmt->bindParam(':r', $reason);
    $stmt->execute();
    return json_encode(['success' => $stmt->rowCount() > 0 ? 1 : 0]);
  }

  /**
   * UPDATE PENDING OVERTIME REQUEST
   * Modifies overtime request details for pending requests only
   * Maintains approval workflow integrity
   */
  function updateOvertime($conn, $json){
    $data = json_decode($json, true);
    $ot_id = isset($data['ot_id']) ? intval($data['ot_id']) : 0;
    if ($ot_id <= 0) { return json_encode(['success' => 0, 'message' => 'Invalid ID']); }

    $employee_id = isset($data['employee_id']) ? intval($data['employee_id']) : 0;
    if ($employee_id <= 0 && isset($_SESSION['user_id'])){
      $u = $conn->prepare('SELECT employee_id FROM tblusers WHERE user_id = :id LIMIT 1');
      $u->bindParam(':id', $_SESSION['user_id'], PDO::PARAM_INT);
      $u->execute();
      $row = $u->fetch(PDO::FETCH_ASSOC);
      if ($row && intval($row['employee_id']) > 0){ $employee_id = intval($row['employee_id']); }
    }
    $work_date = isset($data['work_date']) ? trim($data['work_date']) : '';
    // QR-only: ignore any provided times/hours on update of pending requests
    $start_time = null;
    $end_time = null;
    $hours = null;
    $reason = isset($data['reason']) ? trim($data['reason']) : null;

    if ($employee_id <= 0 || $work_date === ''){
      return json_encode(['success' => 0, 'message' => 'Invalid inputs']);
    }

    // Compute hours if not provided but start/end times are given
    if (($hours === null || $hours <= 0) && $start_time && $end_time) {
      try {
        $st = new DateTime($work_date . ' ' . $start_time);
        $et = new DateTime($work_date . ' ' . $end_time);
        if ($et < $st) { $et->modify('+1 day'); }
        $diff = $et->getTimestamp() - $st->getTimestamp();
        if ($diff > 0) { $hours = round($diff / 3600, 2); }
      } catch (Exception $e) {}
    }

    $sql = "UPDATE tblovertime_requests
            SET employee_id = :eid, work_date = :d, start_time = :st, end_time = :et, hours = :h, reason = :r
            WHERE ot_id = :id AND status = 'pending'";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $stmt->bindParam(':d', $work_date);
    $stmt->bindParam(':st', $start_time);
    $stmt->bindParam(':et', $end_time);
    if ($hours !== null) { $stmt->bindParam(':h', $hours); } else { $null = null; $stmt->bindParam(':h', $null, PDO::PARAM_NULL); }
    $stmt->bindParam(':r', $reason);
    $stmt->bindParam(':id', $ot_id, PDO::PARAM_INT);
    $stmt->execute();
    // Consider success if row exists even if unchanged; fetch confirm
    $ok = $stmt->rowCount() > 0;
    if (!$ok) {
      // Check if record exists and still pending
      try {
        $chk = $conn->prepare("SELECT ot_id FROM tblovertime_requests WHERE ot_id = :id AND status = 'pending' LIMIT 1");
        $chk->bindParam(':id', $ot_id, PDO::PARAM_INT);
        $chk->execute();
        if ($chk->fetch(PDO::FETCH_ASSOC)) { $ok = true; }
      } catch (Exception $e) {}
    }
    return json_encode(['success' => $ok ? 1 : 0]);
  }

  /**
   * GET EMPLOYEE OVERTIME HISTORY
   * Retrieves overtime requests for specific employee
   * Includes approval/rejection details and timestamps
   */
  function listByEmployee($conn){
    $employee_id = isset($_GET['employee_id']) ? intval($_GET['employee_id']) : 0;
    if ($employee_id <= 0) return json_encode([]);
    $sql = "SELECT o.*, u1.username AS approved_by_username, u2.username AS rejected_by_username
            FROM tblovertime_requests o
            LEFT JOIN tblusers u1 ON u1.user_id = o.approved_by
            LEFT JOIN tblusers u2 ON u2.user_id = o.rejected_by
            WHERE o.employee_id = :eid
            ORDER BY o.created_at DESC LIMIT 50";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * GET PENDING OVERTIME REQUESTS
   * Fetches all pending overtime requests for approval
   * Ordered by submission date for processing priority
   */
  function listPending($conn){
    $sql = "SELECT o.*, e.first_name, e.last_name FROM tblovertime_requests o
            INNER JOIN tblemployees e ON e.employee_id = o.employee_id
            WHERE o.status = 'pending'
            ORDER BY o.created_at ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * UPDATE OVERTIME REQUEST STATUS
   * Approves or rejects overtime requests with audit trail
   * Creates notifications for employees about status changes
   */
  function setStatus($conn, $json, $status){
    $data = json_decode($json, true);
    $ot_id = isset($data['ot_id']) ? intval($data['ot_id']) : 0;
    if ($ot_id <= 0) return json_encode(['success' => 0]);
    $actor = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
    $setExtra = '';
    if ($status === 'approved') {
      $setExtra = ', approved_by = :actor, approved_at = NOW(), rejected_by = NULL, rejected_at = NULL';
    } else if ($status === 'rejected') {
      $setExtra = ', rejected_by = :actor, rejected_at = NOW(), approved_by = NULL, approved_at = NULL';
    }
    $sql = "UPDATE tblovertime_requests SET status = :s" . $setExtra . " WHERE ot_id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':s', $status);
    $stmt->bindParam(':id', $ot_id, PDO::PARAM_INT);
    if ($actor !== null) { $stmt->bindParam(':actor', $actor, PDO::PARAM_INT); }
    $stmt->execute();
    $ok = $stmt->rowCount() > 0;

    // Send notification to employee
    if ($ok) {
      try {
        $sel = $conn->prepare('SELECT employee_id FROM tblovertime_requests WHERE ot_id = :id LIMIT 1');
        $sel->bindParam(':id', $ot_id, PDO::PARAM_INT);
        $sel->execute();
        $row = $sel->fetch(PDO::FETCH_ASSOC);
        if ($row && intval($row['employee_id']) > 0) {
          $message = $status === 'approved' ? 'Your overtime request was approved' : 'Your overtime request was rejected';
          $ins = $conn->prepare('INSERT INTO tblnotifications(employee_id, message, type, actor_user_id) VALUES(:eid, :msg, :type, :actor)');
          $type = $status;
          $eid = intval($row['employee_id']);
          $ins->bindParam(':eid', $eid, PDO::PARAM_INT);
          $ins->bindParam(':msg', $message);
          $ins->bindParam(':type', $type);
          if ($actor !== null) { $ins->bindParam(':actor', $actor, PDO::PARAM_INT); } else { $null = null; $ins->bindParam(':actor', $null, PDO::PARAM_NULL); }
          $ins->execute();
        }
      } catch (Exception $e) { /* ignore notification errors */ }
    }

    return json_encode($ok ? 1 : 0);
  }

  function listApproved($conn){
    $sql = "SELECT o.*, e.first_name, e.last_name FROM tblovertime_requests o
            INNER JOIN tblemployees e ON e.employee_id = o.employee_id
            WHERE o.status = 'approved'";
    $params = [];
    if (!empty($_GET['start_date'])) { $sql .= " AND o.work_date >= :start"; $params[':start'] = $_GET['start_date']; }
    if (!empty($_GET['end_date'])) { $sql .= " AND o.work_date <= :end"; $params[':end'] = $_GET['end_date']; }
    $sql .= " ORDER BY o.work_date DESC, o.ot_id DESC";
    $stmt = $conn->prepare($sql);
    foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  function listAll($conn){
    $sql = "SELECT o.*, e.first_name, e.last_name FROM tblovertime_requests o
            INNER JOIN tblemployees e ON e.employee_id = o.employee_id WHERE 1=1";
    $params = [];
    if (!empty($_GET['start_date'])) { $sql .= " AND o.work_date >= :start"; $params[':start'] = $_GET['start_date']; }
    if (!empty($_GET['end_date'])) { $sql .= " AND o.work_date <= :end"; $params[':end'] = $_GET['end_date']; }
    if (!empty($_GET['employee_id'])) { $sql .= " AND o.employee_id = :eid"; $params[':eid'] = intval($_GET['employee_id']); }
    if (!empty($_GET['status'])) { $sql .= " AND o.status = :status"; $params[':status'] = $_GET['status']; }
    $sql .= " ORDER BY o.created_at DESC, o.ot_id DESC";
    $stmt = $conn->prepare($sql);
    foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  function computeOtHours($work_date, $start_time, $end_time){
    if (!$work_date || !$start_time || !$end_time) return null;
    try {
      $st = new DateTime($work_date . ' ' . $start_time);
      $et = new DateTime($work_date . ' ' . $end_time);
      if ($et < $st) { $et->modify('+1 day'); }
      $diff = $et->getTimestamp() - $st->getTimestamp();
      if ($diff > 0) { return round($diff / 3600, 2); }
      return null;
    } catch (Exception $e) { return null; }
  }

  function logScan($conn, $json){
    $data = json_decode($json, true);
    $employee_id = isset($data['employee_id']) ? intval($data['employee_id']) : 0;
    $work_date = isset($data['work_date']) ? trim($data['work_date']) : date('Y-m-d');
    if ($employee_id <= 0) { return json_encode(['success' => 0, 'message' => 'Invalid employee']); }

    $now = date('H:i');

    // Try to find an approved OT record for this employee and date first
    $sel = $conn->prepare("SELECT * FROM tblovertime_requests WHERE employee_id = :eid AND work_date = :d AND status = 'approved' ORDER BY ot_id DESC LIMIT 1");
    $sel->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $sel->bindParam(':d', $work_date);
    $sel->execute();
    $row = $sel->fetch(PDO::FETCH_ASSOC);

    // Enforce approval before scan: do not auto-approve or auto-create
    if (!$row) {
      return json_encode(['success' => 0, 'message' => 'No approved overtime request for today']);
    }
    // Enforce time window for overtime scan: 20:30–22:00; close at 22:01
    $allowedStart = '20:30';
    $allowedEnd = '22:00';
    if ($now < $allowedStart) {
      return json_encode(['success' => 0, 'message' => 'Overtime scan allowed only between 8:30 PM and 10:00 PM']);
    }
    if ($now > $allowedEnd) {
      return json_encode(['success' => 0, 'message' => 'Scanner closed. Please contact HR or Admin to open again.']);
    }

    // We have an approved record already
    $ot_id = intval($row['ot_id']);
    $start = $row['start_time'];
    $end = $row['end_time'];

    if (empty($start)) {
      $upd = $conn->prepare("UPDATE tblovertime_requests SET start_time = :t WHERE ot_id = :id");
      $upd->bindParam(':t', $now);
      $upd->bindParam(':id', $ot_id, PDO::PARAM_INT);
      $upd->execute();
      return json_encode(['success' => 1, 'action' => 'in', 'time' => $now]);
    }

    if (empty($end)) {
      // Prevent double scan from recording time out before 10:00 PM
      $timeOutAllowedAt = '22:00';
      if ($now < $timeOutAllowedAt) {
        return json_encode(['success' => 0, 'message' => 'You are already time in. Time out is allowed at 10:00 PM.']);
      }
      $upd = $conn->prepare("UPDATE tblovertime_requests SET end_time = :t, hours = :h WHERE ot_id = :id");
      // Cap total hours at 22:00 regardless of actual scan-out time
      $effectiveEnd = ($now > '22:00') ? '22:00' : $now;
      $hours = computeOtHours($work_date, $start, $effectiveEnd);
      $upd->bindParam(':t', $now);
      if ($hours !== null) { $upd->bindParam(':h', $hours); } else { $null = null; $upd->bindParam(':h', $null, PDO::PARAM_NULL); }
      $upd->bindParam(':id', $ot_id, PDO::PARAM_INT);
      $upd->execute();
      return json_encode(['success' => 1, 'action' => 'out', 'time' => $now, 'hours' => $hours]);
    }

    return json_encode(['success' => 1, 'action' => 'done', 'message' => 'Overtime already completed']);
  }

  /**
   * ARCHIVE OVERTIME REQUEST
   * Moves approved/rejected overtime requests to archive status
   * Maintains data integrity while cleaning up active requests
   */
  function archiveOvertime($conn, $json){
    $data = json_decode($json, true);
    $ot_id = isset($data['ot_id']) ? intval($data['ot_id']) : 0;
    if ($ot_id <= 0) return json_encode(['success' => 0, 'message' => 'Invalid ID']);
    
    $actor = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
    
    // Only allow archiving of approved or rejected requests
    $sql = "UPDATE tblovertime_requests 
            SET status = 'archived', archived_by = :actor, archived_at = NOW() 
            WHERE ot_id = :id AND status IN ('approved', 'rejected')";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $ot_id, PDO::PARAM_INT);
    if ($actor !== null) { 
      $stmt->bindParam(':actor', $actor, PDO::PARAM_INT); 
    } else { 
      $null = null; 
      $stmt->bindParam(':actor', $null, PDO::PARAM_NULL); 
    }
    $stmt->execute();
    
    $success = $stmt->rowCount() > 0;
    return json_encode(['success' => $success ? 1 : 0]);
  }

  /**
   * LIST ARCHIVED OVERTIME REQUESTS
   * Retrieves all archived overtime requests with employee details
   * Used for archive management and restoration
   */
  function listArchived($conn){
    $sql = "SELECT o.*, e.first_name, e.last_name, e.department,
                   u1.username AS approved_by_username, 
                   u2.username AS rejected_by_username,
                   u3.username AS archived_by_username
            FROM tblovertime_requests o
            INNER JOIN tblemployees e ON e.employee_id = o.employee_id
            LEFT JOIN tblusers u1 ON u1.user_id = o.approved_by
            LEFT JOIN tblusers u2 ON u2.user_id = o.rejected_by
            LEFT JOIN tblusers u3 ON u3.user_id = o.archived_by
            WHERE o.status = 'archived'
            ORDER BY o.archived_at DESC, o.ot_id DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * RESTORE OVERTIME REQUEST FROM ARCHIVE
   * Restores archived overtime request back to its previous status
   * Maintains audit trail of archive/restore actions
   */
  function restoreOvertime($conn, $json){
    $data = json_decode($json, true);
    $ot_id = isset($data['ot_id']) ? intval($data['ot_id']) : 0;
    if ($ot_id <= 0) return json_encode(['success' => 0, 'message' => 'Invalid ID']);
    
    $actor = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
    
    // Get the archived request to determine what status to restore to
    $sel = $conn->prepare("SELECT approved_by, rejected_by FROM tblovertime_requests WHERE ot_id = :id AND status = 'archived' LIMIT 1");
    $sel->bindParam(':id', $ot_id, PDO::PARAM_INT);
    $sel->execute();
    $row = $sel->fetch(PDO::FETCH_ASSOC);
    
    if (!$row) {
      return json_encode(['success' => 0, 'message' => 'Request not found or not archived']);
    }
    
    // Determine the status to restore to based on approval/rejection history
    $restoreStatus = 'pending'; // default
    if ($row['approved_by']) {
      $restoreStatus = 'approved';
    } elseif ($row['rejected_by']) {
      $restoreStatus = 'rejected';
    }
    
    // Restore the request
    $sql = "UPDATE tblovertime_requests 
            SET status = :status, archived_by = NULL, archived_at = NULL, restored_by = :actor, restored_at = NOW()
            WHERE ot_id = :id AND status = 'archived'";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':status', $restoreStatus);
    $stmt->bindParam(':id', $ot_id, PDO::PARAM_INT);
    if ($actor !== null) { 
      $stmt->bindParam(':actor', $actor, PDO::PARAM_INT); 
    } else { 
      $null = null; 
      $stmt->bindParam(':actor', $null, PDO::PARAM_NULL); 
    }
    $stmt->execute();
    
    $success = $stmt->rowCount() > 0;
    return json_encode(['success' => $success ? 1 : 0, 'restored_status' => $restoreStatus]);
  }
?>
