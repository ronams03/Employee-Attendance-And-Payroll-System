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

  $operation = '';
  $json = '';
  if ($_SERVER['REQUEST_METHOD'] == 'GET'){
    $operation = isset($_GET['operation']) ? $_GET['operation'] : '';
  } else if($_SERVER['REQUEST_METHOD'] == 'POST'){
    $operation = isset($_POST['operation']) ? $_POST['operation'] : '';
    $json = isset($_POST['json']) ? $_POST['json'] : '';
  }

  switch ($operation) {
    case 'requestUndertime':
      echo requestUndertime($conn, $json);
      break;
    case 'updateUndertime':
      echo updateUndertime($conn, $json);
      break;
    case 'listByEmployee':
      echo listByEmployee($conn);
      break;
    case 'listPending':
      echo listPending($conn);
      break;
    case 'listAll':
      echo listAll($conn);
      break;
    case 'approve':
      echo setStatus($conn, $json, 'approved');
      break;
    case 'reject':
      echo setStatus($conn, $json, 'rejected');
      break;
    case 'archiveUndertime':
      echo archiveUndertime($conn, $json);
      break;
    case 'listArchived':
      echo listArchived($conn);
      break;
    case 'restoreUndertime':
      echo restoreUndertime($conn, $json);
      break;
    default:
      echo json_encode([]);
  }

  /**
   * SUBMIT UNDERTIME REQUEST
   * Creates new undertime request with employee ID resolution
   * Validates required fields including hours and date
   */
  function requestUndertime($conn, $json){
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
    $hours = isset($data['hours']) ? (float)$data['hours'] : 0;
    $start_time = isset($data['start_time']) && $data['start_time'] !== '' ? trim($data['start_time']) : null;
    $end_time = isset($data['end_time']) && $data['end_time'] !== '' ? trim($data['end_time']) : null;
    $reason = isset($data['reason']) ? trim($data['reason']) : null;

    if ($employee_id <= 0 || $work_date === '' || $hours <= 0){
      return json_encode(['success' => 0, 'message' => 'Invalid inputs']);
    }

    $sql = "INSERT INTO tblundertime_requests (employee_id, work_date, hours, start_time, end_time, reason, status)
            VALUES (:eid, :d, :h, :st, :et, :r, 'pending')";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $stmt->bindParam(':d', $work_date);
    $stmt->bindParam(':h', $hours);
    $stmt->bindParam(':st', $start_time);
    $stmt->bindParam(':et', $end_time);
    $stmt->bindParam(':r', $reason);
    $stmt->execute();
    return json_encode(['success' => $stmt->rowCount() > 0 ? 1 : 0]);
  }

  /**
   * UPDATE PENDING UNDERTIME REQUEST
   * Modifies undertime request details for pending requests only
   * Maintains approval workflow integrity
   */
  function updateUndertime($conn, $json){
    $data = json_decode($json, true);
    $ut_id = isset($data['ut_id']) ? intval($data['ut_id']) : 0;
    if ($ut_id <= 0) { return json_encode(['success' => 0, 'message' => 'Invalid ID']); }

    $employee_id = isset($data['employee_id']) ? intval($data['employee_id']) : 0;
    if ($employee_id <= 0 && isset($_SESSION['user_id'])){
      $u = $conn->prepare('SELECT employee_id FROM tblusers WHERE user_id = :id LIMIT 1');
      $u->bindParam(':id', $_SESSION['user_id'], PDO::PARAM_INT);
      $u->execute();
      $row = $u->fetch(PDO::FETCH_ASSOC);
      if ($row && intval($row['employee_id']) > 0){ $employee_id = intval($row['employee_id']); }
    }
    $work_date = isset($data['work_date']) ? trim($data['work_date']) : '';
    $hours = isset($data['hours']) ? (float)$data['hours'] : 0;
    $start_time = isset($data['start_time']) && $data['start_time'] !== '' ? trim($data['start_time']) : null;
    $end_time = isset($data['end_time']) && $data['end_time'] !== '' ? trim($data['end_time']) : null;
    $reason = isset($data['reason']) ? trim($data['reason']) : null;

    if ($employee_id <= 0 || $work_date === '' || $hours <= 0){
      return json_encode(['success' => 0, 'message' => 'Invalid inputs']);
    }

    $sql = "UPDATE tblundertime_requests
            SET employee_id = :eid, work_date = :d, hours = :h, start_time = :st, end_time = :et, reason = :r
            WHERE ut_id = :id AND status = 'pending'";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $stmt->bindParam(':d', $work_date);
    $stmt->bindParam(':h', $hours);
    $stmt->bindParam(':st', $start_time);
    $stmt->bindParam(':et', $end_time);
    $stmt->bindParam(':r', $reason);
    $stmt->bindParam(':id', $ut_id, PDO::PARAM_INT);
    $stmt->execute();
    $ok = $stmt->rowCount() > 0;
    if (!$ok) {
      try {
        $chk = $conn->prepare("SELECT ut_id FROM tblundertime_requests WHERE ut_id = :id AND status = 'pending' LIMIT 1");
        $chk->bindParam(':id', $ut_id, PDO::PARAM_INT);
        $chk->execute();
        if ($chk->fetch(PDO::FETCH_ASSOC)) { $ok = true; }
      } catch (Exception $e) {}
    }
    return json_encode(['success' => $ok ? 1 : 0]);
  }

  /**
   * GET EMPLOYEE UNDERTIME HISTORY
   * Retrieves undertime requests for specific employee
   * Includes approval/rejection details and timestamps
   */
  function listByEmployee($conn){
    $employee_id = isset($_GET['employee_id']) ? intval($_GET['employee_id']) : 0;
    if ($employee_id <= 0) return json_encode([]);
    $sql = "SELECT u.*, a.username AS approved_by_username, r.username AS rejected_by_username
            FROM tblundertime_requests u
            LEFT JOIN tblusers a ON a.user_id = u.approved_by
            LEFT JOIN tblusers r ON r.user_id = u.rejected_by
            WHERE u.employee_id = :eid
            ORDER BY u.created_at DESC LIMIT 50";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':eid', $employee_id, PDO::PARAM_INT);
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * GET PENDING UNDERTIME REQUESTS
   * Fetches all pending undertime requests for approval
   * Ordered by submission date for processing priority
   */
  function listPending($conn){
    $sql = "SELECT u.*, e.first_name, e.last_name FROM tblundertime_requests u
            INNER JOIN tblemployees e ON e.employee_id = u.employee_id
            WHERE u.status = 'pending'
            ORDER BY u.created_at ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * GET ALL UNDERTIME REQUESTS WITH FILTERING
   * Retrieves undertime requests with optional filters
   * Supports date range, employee, and status filtering
   */
  function listAll($conn){
    $sql = "SELECT u.*, e.first_name, e.last_name FROM tblundertime_requests u
            INNER JOIN tblemployees e ON e.employee_id = u.employee_id WHERE 1=1";
    $params = [];
    if (!empty($_GET['start_date'])) { $sql .= " AND u.work_date >= :start"; $params[':start'] = $_GET['start_date']; }
    if (!empty($_GET['end_date'])) { $sql .= " AND u.work_date <= :end"; $params[':end'] = $_GET['end_date']; }
    if (!empty($_GET['employee_id'])) { $sql .= " AND u.employee_id = :eid"; $params[':eid'] = intval($_GET['employee_id']); }
    if (!empty($_GET['status'])) { $sql .= " AND u.status = :status"; $params[':status'] = $_GET['status']; }
    $sql .= " ORDER BY u.created_at DESC, u.ut_id DESC";
    $stmt = $conn->prepare($sql);
    foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * UPDATE UNDERTIME REQUEST STATUS
   * Approves or rejects undertime requests with audit trail
   * Creates notifications for employees about status changes
   */
  function setStatus($conn, $json, $status){
    $data = json_decode($json, true);
    $ut_id = isset($data['ut_id']) ? intval($data['ut_id']) : 0;
    if ($ut_id <= 0) return json_encode(['success' => 0]);
    $actor = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
    $setExtra = '';
    if ($status === 'approved') {
      $setExtra = ', approved_by = :actor, approved_at = NOW(), rejected_by = NULL, rejected_at = NULL';
    } else if ($status === 'rejected') {
      $setExtra = ', rejected_by = :actor, rejected_at = NOW(), approved_by = NULL, approved_at = NULL';
    }
    $sql = "UPDATE tblundertime_requests SET status = :s" . $setExtra . " WHERE ut_id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':s', $status);
    $stmt->bindParam(':id', $ut_id, PDO::PARAM_INT);
    if ($actor !== null) { $stmt->bindParam(':actor', $actor, PDO::PARAM_INT); }
    $stmt->execute();
    $ok = $stmt->rowCount() > 0;

    // Send notification to employee
    if ($ok) {
      try {
        $sel = $conn->prepare('SELECT employee_id FROM tblundertime_requests WHERE ut_id = :id LIMIT 1');
        $sel->bindParam(':id', $ut_id, PDO::PARAM_INT);
        $sel->execute();
        $row = $sel->fetch(PDO::FETCH_ASSOC);
        if ($row && intval($row['employee_id']) > 0) {
          $message = $status === 'approved' ? 'Your undertime request was approved' : 'Your undertime request was rejected';
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

  /**
   * ARCHIVE UNDERTIME REQUEST
   * Moves approved/rejected undertime requests to archive status
   * Maintains data integrity while cleaning up active requests
   */
  function archiveUndertime($conn, $json){
    $data = json_decode($json, true);
    $ut_id = isset($data['ut_id']) ? intval($data['ut_id']) : 0;
    if ($ut_id <= 0) return json_encode(['success' => 0, 'message' => 'Invalid ID']);
    
    $actor = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
    
    // Only allow archiving of approved or rejected requests
    $sql = "UPDATE tblundertime_requests 
            SET status = 'archived', archived_by = :actor, archived_at = NOW() 
            WHERE ut_id = :id AND status IN ('approved', 'rejected')";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $ut_id, PDO::PARAM_INT);
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
   * LIST ARCHIVED UNDERTIME REQUESTS
   * Retrieves all archived undertime requests with employee details
   * Used for archive management and restoration
   */
  function listArchived($conn){
    $sql = "SELECT u.*, e.first_name, e.last_name, e.department,
                   u1.username AS approved_by_username, 
                   u2.username AS rejected_by_username,
                   u3.username AS archived_by_username
            FROM tblundertime_requests u
            INNER JOIN tblemployees e ON e.employee_id = u.employee_id
            LEFT JOIN tblusers u1 ON u1.user_id = u.approved_by
            LEFT JOIN tblusers u2 ON u2.user_id = u.rejected_by
            LEFT JOIN tblusers u3 ON u3.user_id = u.archived_by
            WHERE u.status = 'archived'
            ORDER BY u.archived_at DESC, u.ut_id DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  /**
   * RESTORE UNDERTIME REQUEST FROM ARCHIVE
   * Restores archived undertime request back to its previous status
   * Maintains audit trail of archive/restore actions
   */
  function restoreUndertime($conn, $json){
    $data = json_decode($json, true);
    $ut_id = isset($data['ut_id']) ? intval($data['ut_id']) : 0;
    if ($ut_id <= 0) return json_encode(['success' => 0, 'message' => 'Invalid ID']);
    
    $actor = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
    
    // Get the archived request to determine what status to restore to
    $sel = $conn->prepare("SELECT approved_by, rejected_by FROM tblundertime_requests WHERE ut_id = :id AND status = 'archived' LIMIT 1");
    $sel->bindParam(':id', $ut_id, PDO::PARAM_INT);
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
    $sql = "UPDATE tblundertime_requests 
            SET status = :status, archived_by = NULL, archived_at = NULL, restored_by = :actor, restored_at = NOW()
            WHERE ut_id = :id AND status = 'archived'";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':status', $restoreStatus);
    $stmt->bindParam(':id', $ut_id, PDO::PARAM_INT);
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
