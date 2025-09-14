<?php
// Simple test for DTR API
header('Content-Type: text/html');

echo "<h2>DTR API Test</h2>";

// Test the API endpoint
$test_url = "http://localhost/intro/api/dtr.php?operation=getDTR&employee_id=1&start_date=2024-01-01&end_date=2024-12-31";

echo "<p>Testing URL: <code>$test_url</code></p>";

$response = file_get_contents($test_url);
if ($response === false) {
    echo "<p style='color: red;'>Failed to get response from API</p>";
} else {
    echo "<h3>Response:</h3>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
    
    $data = json_decode($response, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo "<h3>Parsed JSON:</h3>";
        echo "<pre>" . print_r($data, true) . "</pre>";
    } else {
        echo "<p style='color: red;'>Invalid JSON response</p>";
    }
}

// Test database connection
echo "<h3>Database Connection Test:</h3>";
try {
    include 'api/connection-pdo.php';
    echo "<p style='color: green;'>Database connection successful</p>";
    
    // Test employee query
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM tblemployees");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "<p>Total employees in database: " . $result['count'] . "</p>";
    
    // Test attendance query
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM tblattendance");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "<p>Total attendance records: " . $result['count'] . "</p>";
    
    // Get first employee ID for testing
    $stmt = $conn->prepare("SELECT employee_id, first_name, last_name FROM tblemployees LIMIT 1");
    $stmt->execute();
    $employee = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($employee) {
        echo "<p>Sample employee: ID {$employee['employee_id']} - {$employee['first_name']} {$employee['last_name']}</p>";
        
        // Test DTR API with this employee
        $test_employee_id = $employee['employee_id'];
        echo "<h3>Testing DTR API with Employee ID: $test_employee_id</h3>";
        $test_url = "http://localhost/intro/api/dtr.php?operation=getDTR&employee_id=$test_employee_id&start_date=2024-01-01&end_date=2024-12-31";
        echo "<p>API URL: <code>$test_url</code></p>";
        
        $response = file_get_contents($test_url);
        if ($response === false) {
            echo "<p style='color: red;'>Failed to get response from DTR API</p>";
        } else {
            echo "<h4>DTR API Response:</h4>";
            echo "<pre>" . htmlspecialchars($response) . "</pre>";
        }
    }
    
} catch (Exception $e) {
    echo "<p style='color: red;'>Database error: " . $e->getMessage() . "</p>";
}
?>
