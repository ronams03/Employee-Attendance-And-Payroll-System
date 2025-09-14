<?php
  header('Content-Type: application/json');
  header('Access-Control-Allow-Origin: *');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
  }

  if (session_status() === PHP_SESSION_NONE) { session_start(); }

  require_once __DIR__ . '/connection-pdo.php';

  $method = $_SERVER['REQUEST_METHOD'];
  $operation = '';
  $json = '';
  if ($method === 'GET') {
    $operation = isset($_GET['operation']) ? $_GET['operation'] : 'list';
  } else if ($method === 'POST') {
    $operation = isset($_POST['operation']) ? $_POST['operation'] : '';
    $json = isset($_POST['json']) ? $_POST['json'] : '';
  }

  try {
    switch ($operation) {
      case 'list':
        echo listHolidays($conn);
        break;
      case 'create':
        echo createHoliday($conn, $json);
        break;
      case 'update':
        echo updateHoliday($conn, $json);
        break;
      case 'delete':
        echo deleteHoliday($conn, $json);
        break;
      case 'get':
        echo getHoliday($conn);
        break;
      default:
        http_response_code(400);
        echo json_encode(['success' => 0, 'message' => 'Invalid operation']);
    }
  } catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => 0, 'message' => 'Server error', 'error' => $e->getMessage()]);
  }

  /**
   * RETRIEVE HOLIDAYS LIST
   * Fetches holidays within specified date range or current month
   * Supports month/year filtering for calendar display
   */
  function listHolidays($conn) {
    $start = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
    $end = isset($_GET['end_date']) ? trim($_GET['end_date']) : '';
    $month = isset($_GET['month']) ? (int)$_GET['month'] : 0;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : 0;

    if ($start === '' || $end === '') {
      if ($month < 1 || $month > 12 || $year < 1970 || $year > 9999) {
        $now = new DateTime('now', new DateTimeZone('UTC'));
        $year = (int)$now->format('Y');
        $month = (int)$now->format('n');
      }
      $start = sprintf('%04d-%02d-01', $year, $month);
      $lastDay = (int)date('t', strtotime($start));
      $end = sprintf('%04d-%02d-%02d', $year, $month, $lastDay);
    }

    $sql = 'SELECT id, holiday_date, holiday_name, description, created_at, updated_at FROM tblholidays WHERE holiday_date BETWEEN :start AND :end ORDER BY holiday_date ASC, id ASC';
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':start', $start);
    $stmt->bindParam(':end', $end);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return json_encode($rows);
  }

  /**
   * CREATE NEW HOLIDAY
   * Adds holiday to system with date and description
   * Validates date format and required fields
   */
  function createHoliday($conn, $json) {
    $data = json_decode($json, true);
    if (!is_array($data)) { http_response_code(422); return json_encode(['success' => 0, 'message' => 'Invalid payload']); }
    $date = isset($data['holiday_date']) ? trim($data['holiday_date']) : '';
    $name = isset($data['holiday_name']) ? trim($data['holiday_name']) : '';
    $desc = isset($data['description']) ? trim((string)$data['description']) : null;

    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
      http_response_code(422);
      return json_encode(['success' => 0, 'message' => 'Valid date (YYYY-MM-DD) is required']);
    }
    if ($name === '') {
      http_response_code(422);
      return json_encode(['success' => 0, 'message' => 'Holiday name is required']);
    }

    $sql = 'INSERT INTO tblholidays (holiday_date, holiday_name, description) VALUES (:d, :n, :desc)';
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':d', $date);
    $stmt->bindParam(':n', $name);
    $stmt->bindParam(':desc', $desc);
    $stmt->execute();

    $id = (int)$conn->lastInsertId();
    $row = getHolidayById($conn, $id);
    return json_encode(['success' => 1, 'data' => $row]);
  }

  /**
   * UPDATE EXISTING HOLIDAY
   * Modifies holiday details with field validation
   * Supports partial updates of holiday information
   */
  function updateHoliday($conn, $json) {
    $data = json_decode($json, true);
    if (!is_array($data)) { http_response_code(422); return json_encode(['success' => 0, 'message' => 'Invalid payload']); }
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if ($id <= 0) { http_response_code(422); return json_encode(['success' => 0, 'message' => 'Invalid id']); }

    $fields = [];
    if (isset($data['holiday_date'])) {
      $date = trim($data['holiday_date']);
      if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { $fields['holiday_date'] = $date; }
    }
    if (isset($data['holiday_name'])) {
      $name = trim($data['holiday_name']);
      if ($name !== '') { $fields['holiday_name'] = $name; }
    }
    if (array_key_exists('description', $data)) {
      $fields['description'] = trim((string)$data['description']);
    }
    if (empty($fields)) { return json_encode(['success' => 0, 'message' => 'Nothing to update']); }

    $set = [];
    foreach ($fields as $k => $v) { $set[] = "$k = :$k"; }
    $sql = 'UPDATE tblholidays SET ' . implode(', ', $set) . ' WHERE id = :id';
    $stmt = $conn->prepare($sql);
    foreach ($fields as $k => $v) { $stmt->bindValue(":$k", $v); }
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    $row = getHolidayById($conn, $id);
    return json_encode(['success' => 1, 'data' => $row]);
  }

  /**
   * DELETE HOLIDAY RECORD
   * Removes holiday from system by ID
   * Used for holiday management cleanup
   */
  function deleteHoliday($conn, $json) {
    $data = json_decode($json, true);
    if (!is_array($data)) { http_response_code(422); return json_encode(['success' => 0]); }
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if ($id <= 0) { http_response_code(422); return json_encode(['success' => 0]); }
    $stmt = $conn->prepare('DELETE FROM tblholidays WHERE id = :id');
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    return json_encode(['success' => 1]);
  }

  /**
   * GET SINGLE HOLIDAY BY ID
   * Retrieves detailed holiday information
   * Used for editing and display purposes
   */
  function getHoliday($conn) {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) { http_response_code(422); return json_encode(['success' => 0]); }
    $row = getHolidayById($conn, $id);
    return json_encode(['success' => $row ? 1 : 0, 'data' => $row]);
  }

  /**
   * HELPER: GET HOLIDAY BY ID
   * Internal function to fetch holiday details
   * Reused by multiple operations
   */
  function getHolidayById($conn, $id) {
    $stmt = $conn->prepare('SELECT id, holiday_date, holiday_name, description, created_at, updated_at FROM tblholidays WHERE id = :id');
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetch(PDO::FETCH_ASSOC);
  }
