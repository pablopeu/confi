<?php
// Script de diagnóstico para límites de subida de archivos
header('Content-Type: text/plain; charset=utf-8');

echo "=== DIAGNÓSTICO DE LÍMITES DE SUBIDA ===\n\n";

// Configuraciones PHP relevantes
$settings = [
    'max_file_uploads',
    'max_input_vars',
    'upload_max_filesize',
    'post_max_size',
    'memory_limit',
    'max_execution_time',
    'max_input_time',
];

echo "--- Configuración PHP ---\n";
foreach ($settings as $setting) {
    $value = ini_get($setting);
    echo "$setting = $value\n";
}

// Verificar si hay módulos adicionales
echo "\n--- Módulos PHP ---\n";
if (extension_loaded('suhosin')) {
    echo "⚠️ SUHOSIN está activado (puede limitar uploads)\n";
    $suhosinSettings = [
        'suhosin.upload.max_uploads',
        'suhosin.request.max_vars',
        'suhosin.post.max_vars',
        'suhosin.get.max_vars',
    ];
    foreach ($suhosinSettings as $setting) {
        $value = ini_get($setting);
        if ($value) {
            echo "$setting = $value\n";
        }
    }
} else {
    echo "✓ SUHOSIN no está activado\n";
}

// Información del servidor
echo "\n--- Información del Servidor ---\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Web Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown') . "\n";

// Límites de archivos reales recibidos
echo "\n--- Límites Prácticos ---\n";
if (!empty($_FILES)) {
    $fileCount = isset($_FILES['photos']['name']) ? count($_FILES['photos']['name']) : 0;
    echo "Archivos recibidos en este request: $fileCount\n";

    if ($fileCount > 0) {
        echo "Nombres de archivos recibidos:\n";
        for ($i = 0; $i < min($fileCount, 30); $i++) {
            $name = $_FILES['photos']['name'][$i] ?? 'N/A';
            $error = $_FILES['photos']['error'][$i] ?? 'N/A';
            $size = $_FILES['photos']['size'][$i] ?? 0;
            echo "  [$i] $name (error: $error, size: $size bytes)\n";
        }
        if ($fileCount > 30) {
            echo "  ... y " . ($fileCount - 30) . " archivos más\n";
        }
    }
} else {
    echo "No se recibieron archivos en este request.\n";
    echo "Para probar: curl -F 'photos[]=@archivo1.jpg' -F 'photos[]=@archivo2.jpg' ... " . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] . "?test=1\n";
}

echo "\n=== FIN DEL DIAGNÓSTICO ===\n";
