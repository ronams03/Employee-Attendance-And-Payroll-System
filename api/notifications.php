<?php
  header('Content-Type: application/json');
  header('Access-Control-Allow-Origin: *');

  if (session_status() === PHP_SESSION_NONE) {
    session_start();
  }

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
    case 'getNotifications':
      echo getNotifications($conn);
      break;
    case 'markAsRead':
      echo markAsRead($conn, $json);
      break;
    case 'deleteNotification':
      echo deleteNotification($conn, $json);
      break;
    case 'markAllAsRead':
      echo markAllAsRead($conn);
      break;
    default:
      echo json_encode(['success' => 0, 'message' => 'Invalid operation']);
  }

  /**
   * RETRIEVE USER NOTIFICATIONS
   * Fetches notifications for logged-in employee
   * Returns latest 50 notifications ordered by creation date
   */
  function getNotifications($conn){
    if (!isset($_SESSION['user_id'])){
      return json_encode(['success' => 0, 'message' => 'Not authenticated']);
    }
    
    try {
      // Get employee_id from the logged-in user
      $stmt = $conn->prepare("SELECT employee_id FROM tblusers WHERE user_id = :user_id LIMIT 1");
      $stmt->bindParam(':user_id', $_SESSION['user_id'], PDO::PARAM_INT);
      $stmt->execute();
      $user = $stmt->fetch(PDO::FETCH_ASSOC);
      
      if (!$user || !$user['employee_id']) {
        return json_encode(['success' => 0, 'message' => 'No employee mapping found']);
      }
      
      $employee_id = intval($user['employee_id']);
      
      // Get notifications for this employee
      $stmt = $conn->prepare("SELECT * FROM tblnotifications WHERE employee_id = :employee_id ORDER BY created_at DESC LIMIT 50");
      $stmt->bindParam(':employee_id', $employee_id, PDO::PARAM_INT);
      $stmt->execute();
      
      $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
      
      return json_encode([
        'success' => 1,
        'notifications' => $notifications,
        'tblnotifications' => $notifications
      ]);
      
    } catch (Exception $e) {
      return json_encode(['success' => 0, 'message' => 'Database error: ' . $e->getMessage()]);
    }
  }

  /**
   * MARK NOTIFICATION AS READ
   * Updates notification read timestamp
   * Used for notification status management
   */
  function markAsRead($conn, $json){
    if (!isset($_SESSION['user_id'])){
      return json_encode(['success' => 0, 'message' => 'Not authenticated']);
    }
    
    $data = json_decode($json, true);
    if (!isset($data['notification_id'])) {
      return json_encode(['success' => 0, 'message' => 'Notification ID required']);
    }
    
    try {
      $stmt = $conn->prepare("UPDATE tblnotifications SET read_at = NOW() WHERE id = :id");
      $stmt->bindParam(':id', $data['notification_id'], PDO::PARAM_INT);
      $stmt->execute();
      
      return json_encode(['success' => 1]);
      
    } catch (Exception $e) {
      return json_encode(['success' => 0, 'message' => 'Database error: ' . $e->getMessage()]);
    }
  }

  /**
   * MARK ALL NOTIFICATIONS AS READ
   * Bulk update of unread notifications for current user
   * Improves user experience for notification cleanup
   */
  function markAllAsRead($conn){
    if (!isset($_SESSION['user_id'])){
      return json_encode(['success' => 0, 'message' => 'Not authenticated']);
    }
    try {
      // Resolve current user's employee_id
      $stmt = $conn->prepare("SELECT employee_id FROM tblusers WHERE user_id = :user_id LIMIT 1");
      $stmt->bindParam(':user_id', $_SESSION['user_id'], PDO::PARAM_INT);
      $stmt->execute();
      $user = $stmt->fetch(PDO::FETCH_ASSOC);
      if (!$user || !$user['employee_id']) {
        return json_encode(['success' => 0, 'message' => 'No employee mapping found']);
      }
      $eid = (int)$user['employee_id'];
      $upd = $conn->prepare("UPDATE tblnotifications SET read_at = NOW() WHERE employee_id = :eid AND read_at IS NULL");
      $upd->bindParam(':eid', $eid, PDO::PARAM_INT);
      $upd->execute();
      return json_encode(['success' => 1]);
    } catch (Exception $e) {
      return json_encode(['success' => 0, 'message' => 'Database error: ' . $e->getMessage()]);
    }
  }

  /**
   * DELETE SINGLE NOTIFICATION
   * Permanently removes notification from system
   * Used for notification management and cleanup
   */
  function deleteNotification($conn, $json){
    if (!isset($_SESSION['user_id'])){
      return json_encode(['success' => 0, 'message' => 'Not authenticated']);
    }
    
    $data = json_decode($json, true);
    if (!isset($data['notification_id'])) {
      return json_encode(['success' => 0, 'message' => 'Notification ID required']);
    }
    
    try {
      $stmt = $conn->prepare("DELETE FROM tblnotifications WHERE id = :id");
      $stmt->bindParam(':id', $data['notification_id'], PDO::PARAM_INT);
      $stmt->execute();
      
      return json_encode(['success' => 1]);
      
    } catch (Exception $e) {
      return json_encode(['success' => 0, 'message' => 'Database error: ' . $e->getMessage()]);
    }
  }
?>
