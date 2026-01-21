<?php
header('Content-Type: application/json');
$limits = [
    'max_file_uploads' => ini_get('max_file_uploads'),
    'max_input_vars' => ini_get('max_input_vars'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'memory_limit' => ini_get('memory_limit'),
];
echo json_encode($limits, JSON_PRETTY_PRINT);
