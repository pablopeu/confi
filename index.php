<?php
/**
 * FotoCRM - Index principal con título dinámico
 * Genera el HTML con el título configurado en el backend
 */

// Configuración
define('DATA_DIR', __DIR__ . '/data');
define('CONFIG_FILE', DATA_DIR . '/config.json');

// Función para transformar campo de configuración según idioma
function transformConfigField($value, $lang = 'es') {
    if (is_array($value) && isset($value['es'])) {
        return $value[$lang] ?? $value['es'];
    }
    return $value;
}

// Detectar idioma
$lang = isset($_GET['lang']) ? $_GET['lang'] : 'es';
if (!in_array($lang, ['es', 'en'])) {
    $lang = 'es';
}

// Cargar configuración
$siteTitle = 'PEU Cuchillos Artesanales'; // Valor por defecto
if (file_exists(CONFIG_FILE)) {
    $config = json_decode(file_get_contents(CONFIG_FILE), true);
    if ($config && isset($config['site_title'])) {
        $siteTitle = transformConfigField($config['site_title'], $lang);
    }
}

// Leer el contenido de index.html
$indexHtmlPath = __DIR__ . '/frontend/index.html';
$htmlContent = file_get_contents($indexHtmlPath);

// Reemplazar el título
$htmlContent = preg_replace('/<title>.*?<\/title>/i', '<title>' . htmlspecialchars($siteTitle) . '</title>', $htmlContent);

// Servir el HTML modificado
echo $htmlContent;
