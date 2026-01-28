<?php
/**
 * FotoCRM API - Backend PHP
 * Sistema de Tags para catálogo de cuchillos
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración
define('DATA_DIR', __DIR__ . '/../data');
define('UPLOADS_DIR', __DIR__ . '/../uploads');
define('BACKUPS_DIR', __DIR__ . '/../backups');
define('CONFIGURATOR_DIR', DATA_DIR . '/configurator');
define('CONFIG_FILE', DATA_DIR . '/config.json');
define('LOCALES_DIR', __DIR__ . '/locales');

// Sistema de traducciones
$TRANSLATIONS = null;
$CURRENT_LANG = 'es';

function loadTranslations($lang = 'es') {
    global $TRANSLATIONS, $CURRENT_LANG;

    // Validar idioma
    if (!in_array($lang, ['es', 'en'])) {
        $lang = 'es';
    }

    $CURRENT_LANG = $lang;
    $filePath = LOCALES_DIR . '/' . $lang . '/messages.json';

    if (file_exists($filePath)) {
        $content = file_get_contents($filePath);
        $TRANSLATIONS = json_decode($content, true);
    } else {
        $TRANSLATIONS = [];
    }
}

function t($key) {
    global $TRANSLATIONS;

    // Convertir "auth.required" en ["auth"]["required"]
    $keys = explode('.', $key);
    $value = $TRANSLATIONS;

    foreach ($keys as $k) {
        if (isset($value[$k])) {
            $value = $value[$k];
        } else {
            return $key; // Retornar la key si no existe traducción
        }
    }

    return is_string($value) ? $value : $key;
}

// Detectar idioma del query string
$requestedLang = isset($_GET['lang']) ? $_GET['lang'] : 'es';
loadTranslations($requestedLang);

// Cargar configuración de usuario/contraseña
function getConfig() {
    if (file_exists(CONFIG_FILE)) {
        $config = json_decode(file_get_contents(CONFIG_FILE), true);
        if ($config) return $config;
    }
    return ['user' => 'admin', 'pass' => 'admin123'];
}

function saveConfig($config) {
    file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT));
}

// Verificar si una string es un hash de contraseña válido
function isPasswordHash($string) {
    // Los hashes de password_hash() empiezan con $2y$ (bcrypt)
    return preg_match('/^\$2[ayb]\$.{56}$/', $string);
}

// Verificar contraseña (soporta plaintext legacy y hash)
function verifyPassword($password, $storedPassword) {
    // Si es un hash, usar password_verify
    if (isPasswordHash($storedPassword)) {
        return password_verify($password, $storedPassword);
    }
    // Si es plaintext (legacy), comparación directa
    return $password === $storedPassword;
}

// Migrar contraseña plaintext a hash si es necesario
function migratePasswordIfNeeded($config, $password) {
    if (!isPasswordHash($config['pass'])) {
        // La contraseña actual es plaintext, migrar a hash
        $config['pass'] = password_hash($password, PASSWORD_DEFAULT);
        saveConfig($config);
    }
}

$CONFIG = getConfig();
define('ADMIN_USER', $CONFIG['user']);
define('ADMIN_PASS', $CONFIG['pass']);

// Leer input UNA sola vez y almacenarlo globalmente
$RAW_INPUT = file_get_contents('php://input');
$JSON_INPUT = json_decode($RAW_INPUT, true) ?: [];

if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
if (!is_dir(UPLOADS_DIR)) mkdir(UPLOADS_DIR, 0755, true);
if (!is_dir(CONFIGURATOR_DIR)) mkdir(CONFIGURATOR_DIR, 0755, true);

// Inicializar archivos JSON si no existen
function initializeData() {
    $categoriesFile = DATA_DIR . '/categories.json';
    $photosFile = DATA_DIR . '/photos.json';
    $bucketsFile = DATA_DIR . '/buckets.json';

    // Inicializar categories.json si no existe
    if (!file_exists($categoriesFile)) {
        $defaultCategories = [
            'tag_groups' => [
                [
                    'id' => 'tipo',
                    'name' => 'Tipo',
                    'tags' => []
                ],
                [
                    'id' => 'encabado',
                    'name' => 'Encabado',
                    'tags' => []
                ],
                [
                    'id' => 'acero',
                    'name' => 'Acero',
                    'tags' => []
                ],
                [
                    'id' => 'extras',
                    'name' => 'Extras',
                    'tags' => []
                ]
            ]
        ];
        file_put_contents($categoriesFile, json_encode($defaultCategories, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    // Inicializar photos.json si no existe
    if (!file_exists($photosFile)) {
        $defaultPhotos = ['photos' => []];
        file_put_contents($photosFile, json_encode($defaultPhotos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    // Inicializar buckets.json si no existe
    if (!file_exists($bucketsFile)) {
        $defaultBuckets = ['buckets' => []];
        file_put_contents($bucketsFile, json_encode($defaultBuckets, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// Ejecutar inicialización
initializeData();

// Funciones de utilidad
function readJSON($filename) {
    $filepath = DATA_DIR . '/' . $filename;

    // Determinar estructura por defecto
    $defaultStructure = ['photos' => []];
    if ($filename === 'categories.json') {
        $defaultStructure = ['tag_groups' => []];
    } elseif ($filename === 'buckets.json') {
        $defaultStructure = ['buckets' => []];
    }

    // Verificar si el archivo existe
    if (!file_exists($filepath)) {
        return $defaultStructure;
    }

    // Leer el contenido del archivo
    $content = file_get_contents($filepath);
    if ($content === false) {
        return $defaultStructure;
    }

    // Decodificar JSON
    $data = json_decode($content, true);

    // Si hay error en el JSON, devolver estructura por defecto
    if (json_last_error() !== JSON_ERROR_NONE) {
        return $defaultStructure;
    }

    // Si $data es null pero no hubo error, devolver estructura por defecto
    if ($data === null) {
        return $defaultStructure;
    }

    return $data;
}

function writeJSON($filename, $data) {
    $filepath = DATA_DIR . '/' . $filename;
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if ($json === false) {
        return false;
    }

    $result = file_put_contents($filepath, $json);

    if ($result === false) {
        return false;
    }

    return true;
}

function sanitize($str) {
    if (!is_string($str)) return $str;
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function generateConfigCode() {
    $characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
    $code = '';
    for ($i = 0; $i < 8; $i++) {
        $code .= $characters[mt_rand(0, strlen($characters) - 1)];
    }
    return $code;
}

function generateUniqueConfigCode() {
    $maxAttempts = 100;
    for ($i = 0; $i < $maxAttempts; $i++) {
        $code = generateConfigCode();
        $filepath = CONFIGURATOR_DIR . '/' . $code . '.json';
        if (!file_exists($filepath)) {
            return $code;
        }
    }
    // Si después de 100 intentos no se encontró un código único, usar timestamp
    return generateConfigCode() . substr(time(), -2);
}

function checkAuth() {
    global $JSON_INPUT;
    $user = null;
    $pass = null;

    // 1. Intentar desde parámetros POST/JSON (método más compatible)
    if (!empty($_POST['auth_user']) && !empty($_POST['auth_pass'])) {
        $user = $_POST['auth_user'];
        $pass = $_POST['auth_pass'];
    } elseif (!empty($JSON_INPUT['auth_user']) && !empty($JSON_INPUT['auth_pass'])) {
        $user = $JSON_INPUT['auth_user'];
        $pass = $JSON_INPUT['auth_pass'];
    }
    // 2. Intentar desde query string (para GET requests)
    elseif (!empty($_GET['auth_user']) && !empty($_GET['auth_pass'])) {
        $user = $_GET['auth_user'];
        $pass = $_GET['auth_pass'];
    }
    // 3. Intentar PHP_AUTH (si el hosting lo permite)
    elseif (isset($_SERVER['PHP_AUTH_USER']) && isset($_SERVER['PHP_AUTH_PW'])) {
        $user = $_SERVER['PHP_AUTH_USER'];
        $pass = $_SERVER['PHP_AUTH_PW'];
    }
    // 4. Intentar header Authorization manual
    else {
        $authHeader = null;
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        }

        if ($authHeader && preg_match('/Basic\s+(.*)$/i', $authHeader, $matches)) {
            $decoded = base64_decode($matches[1]);
            if ($decoded && strpos($decoded, ':') !== false) {
                list($user, $pass) = explode(':', $decoded, 2);
            }
        }
    }

    if (!$user || !$pass) {
        http_response_code(401);
        echo json_encode(['error' => t('auth.required')]);
        exit;
    }

    // Verificar usuario
    if ($user !== ADMIN_USER) {
        http_response_code(401);
        echo json_encode(['error' => t('auth.invalid_credentials')]);
        exit;
    }

    // Verificar contraseña (soporta plaintext legacy y hash)
    if (!verifyPassword($pass, ADMIN_PASS)) {
        http_response_code(401);
        echo json_encode(['error' => t('auth.invalid_credentials')]);
        exit;
    }

    // Migrar contraseña a hash si aún está en plaintext
    $config = getConfig();
    migratePasswordIfNeeded($config, $pass);
}

function response($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getInput() {
    global $JSON_INPUT;
    return $JSON_INPUT;
}

// Transformar datos de categorías según idioma
function transformCategoriesForLanguage($data, $lang = 'es') {
    if (!isset($data['tag_groups'])) {
        return $data;
    }

    $transformed = ['tag_groups' => []];

    foreach ($data['tag_groups'] as $group) {
        $transformedGroup = [
            'id' => $group['id'],
            'name' => is_array($group['name']) ? ($group['name'][$lang] ?? $group['name']['es']) : $group['name'],
            'tags' => []
        ];

        if (isset($group['tags']) && is_array($group['tags'])) {
            foreach ($group['tags'] as $tag) {
                $transformedGroup['tags'][] = [
                    'id' => $tag['id'],
                    'name' => is_array($tag['name']) ? ($tag['name'][$lang] ?? $tag['name']['es']) : $tag['name']
                ];
            }
        }

        $transformed['tag_groups'][] = $transformedGroup;
    }

    return $transformed;
}

// Transformar un campo de configuración según idioma
// Si es string, lo devuelve tal cual
// Si es {es: "", en: ""}, devuelve el valor del idioma solicitado
function transformConfigField($value, $lang = 'es') {
    if (is_array($value) && isset($value['es'])) {
        return $value[$lang] ?? $value['es'];
    }
    return $value;
}

// Obtener la ruta
$path = isset($_GET['route']) ? $_GET['route'] : '';
if (empty($path)) {
    $requestUri = $_SERVER['REQUEST_URI'];
    $basePath = dirname($_SERVER['SCRIPT_NAME']);
    $path = str_replace($basePath, '', parse_url($requestUri, PHP_URL_PATH));
    $path = preg_replace('/^index\.php\/?/', '', $path);
}
$path = trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Router
switch (true) {
    // Admin verify (verificar credenciales)
    case $path === 'admin/verify' && $method === 'GET':
        checkAuth();
        response(['status' => 'ok', 'message' => t('auth.authenticated')]);
        break;

    // PUT /admin/password - Cambiar contraseña
    case $path === 'admin/password' && $method === 'PUT':
        checkAuth();
        $input = getInput();

        if (empty($input['new_password'])) {
            response(['error' => 'new_password required'], 400);
        }

        $newPass = $input['new_password'];
        if (strlen($newPass) < 6) {
            response(['error' => t('auth.password_min_length')], 400);
        }

        $config = getConfig();
        // Guardar contraseña hasheada (bcrypt)
        $config['pass'] = password_hash($newPass, PASSWORD_DEFAULT);
        saveConfig($config);

        response(['status' => 'ok', 'message' => t('auth.password_updated')]);
        break;

    // GET /tags - Obtener grupos de tags
    case ($path === 'tags' || $path === 'categories') && $method === 'GET':
        // Headers anti-caché
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Cache-Control: post-check=0, pre-check=0', false);
        header('Pragma: no-cache');
        header('Expires: 0');

        $lang = isset($_GET['lang']) ? $_GET['lang'] : 'es';
        // Validar idioma
        if (!in_array($lang, ['es', 'en'])) {
            $lang = 'es';
        }

        $data = readJSON('categories.json');

        // Si viene del admin (con auth params), NO transformar - devolver datos completos multilingües
        $isAdmin = !empty($_GET['auth_user']) && !empty($_GET['auth_pass']);

        if ($isAdmin) {
            response($data);
        } else {
            $transformed = transformCategoriesForLanguage($data, $lang);
            response($transformed);
        }
        break;

    // GET /photos - Listar fotos
    case $path === 'photos' && $method === 'GET':
        response(readJSON('photos.json'));
        break;

    // GET /buckets - Obtener buckets de upload
    case $path === 'buckets' && $method === 'GET':
        response(readJSON('buckets.json'));
        break;

    // DELETE /admin/buckets/{id} - Eliminar un bucket (no las fotos, solo el bucket)
    case preg_match('/^admin\/buckets\/([a-zA-Z0-9-]+)$/', $path, $matches) && $method === 'DELETE':
        checkAuth();

        $bucketId = $matches[1];
        $data = readJSON('buckets.json');

        $originalCount = count($data['buckets']);
        $data['buckets'] = array_values(array_filter($data['buckets'], fn($b) => $b['id'] !== $bucketId));

        if (count($data['buckets']) === $originalCount) {
            response(['error' => t('bucket.not_found')], 404);
        }

        writeJSON('buckets.json', $data);
        response(['message' => t('bucket.deleted')]);
        break;

    // DELETE /admin/buckets/{id}/photos - Eliminar bucket y todas sus fotos del sistema
    case preg_match('/^admin\/buckets\/([a-zA-Z0-9-]+)\/photos$/', $path, $matches) && $method === 'DELETE':
        checkAuth();

        $bucketId = $matches[1];
        $bucketsData = readJSON('buckets.json');

        // Buscar el bucket
        $bucketIndex = null;
        $bucket = null;
        foreach ($bucketsData['buckets'] as $i => $b) {
            if ($b['id'] === $bucketId) {
                $bucketIndex = $i;
                $bucket = $b;
                break;
            }
        }

        if ($bucket === null) {
            response(['error' => t('bucket.not_found')], 404);
        }

        // Obtener IDs de fotos del bucket
        $photoIds = array_map(fn($p) => $p['id'], $bucket['photos']);

        // Eliminar archivos físicos de las fotos
        foreach ($bucket['photos'] as $photo) {
            $filePath = UPLOADS_DIR . '/' . basename($photo['url']);
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        // Eliminar fotos del archivo photos.json
        $photosData = readJSON('photos.json');
        $originalPhotoCount = count($photosData['photos']);
        $photosData['photos'] = array_values(array_filter($photosData['photos'], fn($p) => !in_array($p['id'], $photoIds)));
        writeJSON('photos.json', $photosData);

        // Eliminar el bucket
        $bucketsData['buckets'] = array_values(array_filter($bucketsData['buckets'], fn($b) => $b['id'] !== $bucketId));
        writeJSON('buckets.json', $bucketsData);

        response([
            'message' => 'Bucket y fotos eliminadas del sistema',
            'photos_deleted' => $originalPhotoCount - count($photosData['photos'])
        ]);
        break;

    // ==================
    // RUTAS ADMIN
    // ==================

    // POST /admin/tags - Crear nuevo tag en un grupo
    case $path === 'admin/tags' && $method === 'POST':
        checkAuth();
        $input = getInput();

        if (empty($input['group_id']) || empty($input['name'])) {
            response(['error' => 'group_id y name son requeridos'], 400);
        }

        $data = readJSON('categories.json');

        // Handle multilingual name
        if (is_array($input['name'])) {
            $tagId = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $input['name']['es'] ?? $input['name']['en'] ?? ''));
            $newTag = [
                'id' => $tagId,
                'name' => [
                    'es' => sanitize($input['name']['es'] ?? ''),
                    'en' => sanitize($input['name']['en'] ?? '')
                ]
            ];
        } else {
            $tagId = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $input['name']));
            $newTag = [
                'id' => $tagId,
                'name' => sanitize($input['name'])
            ];
        }

        $found = false;
        foreach ($data['tag_groups'] as &$group) {
            if ($group['id'] === $input['group_id']) {
                // Verificar que no exista
                foreach ($group['tags'] as $tag) {
                    if ($tag['id'] === $tagId) {
                        response(['error' => t('tag.already_exists')], 400);
                    }
                }
                $group['tags'][] = $newTag;
                $found = true;
                break;
            }
        }

        if (!$found) {
            response(['error' => t('tag.group_not_found')], 404);
        }

        writeJSON('categories.json', $data);
        response($newTag, 201);
        break;

    // DELETE /admin/tags/{groupId}/{tagId}
    case preg_match('/^admin\/tags\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/', $path, $matches) && $method === 'DELETE':
        checkAuth();
        $groupId = $matches[1];
        $tagId = $matches[2];

        $data = readJSON('categories.json');
        $found = false;

        foreach ($data['tag_groups'] as &$group) {
            if ($group['id'] === $groupId) {
                foreach ($group['tags'] as $key => $tag) {
                    if ($tag['id'] === $tagId) {
                        unset($group['tags'][$key]);
                        $group['tags'] = array_values($group['tags']);
                        $found = true;
                        break 2;
                    }
                }
            }
        }

        if (!$found) {
            response(['error' => t('tag.not_found')], 404);
        }

        writeJSON('categories.json', $data);
        response(['message' => t('tag.deleted')]);
        break;

    // PUT /admin/tag-groups/{groupId}/reorder - Reordenar tags de un grupo
    case preg_match('/^admin\/tag-groups\/([a-zA-Z0-9-]+)\/reorder$/', $path, $matches) && $method === 'PUT':
        checkAuth();
        $input = getInput();
        $groupId = $matches[1];

        if (empty($input['tag_order']) || !is_array($input['tag_order'])) {
            response(['error' => 'tag_order array is required'], 400);
        }

        $data = readJSON('categories.json');
        $found = false;

        // Buscar el grupo
        for ($i = 0; $i < count($data['tag_groups']); $i++) {
            if ($data['tag_groups'][$i]['id'] === $groupId) {
                $group = &$data['tag_groups'][$i];
                $oldTags = $group['tags'];
                $newOrder = $input['tag_order'];

                // Crear nuevo array de tags en el orden especificado
                $reorderedTags = [];
                foreach ($newOrder as $tagId) {
                    foreach ($oldTags as $tag) {
                        if ($tag['id'] === $tagId) {
                            $reorderedTags[] = $tag;
                            break;
                        }
                    }
                }

                // Verificar que todos los tags estén presentes
                if (count($reorderedTags) === count($oldTags)) {
                    $group['tags'] = $reorderedTags;
                    $found = true;
                } else {
                    response(['error' => 'Invalid tag_order: missing or extra tags'], 400);
                }
                break;
            }
        }

        if (!$found) {
            response(['error' => t('tag.group_not_found')], 404);
        }

        writeJSON('categories.json', $data);
        response(['success' => true, 'message' => 'Tags reordered successfully']);
        break;

    // PUT /admin/tag-groups/{groupId} - Renombrar grupo
    case preg_match('/^admin\/tag-groups\/([a-zA-Z0-9-]+)$/', $path, $matches) && $method === 'PUT':
        checkAuth();
        $input = getInput();
        $data = readJSON('categories.json');

        $found = false;
        $updatedGroup = null;

        // Buscar y actualizar sin referencias
        for ($i = 0; $i < count($data['tag_groups']); $i++) {
            if ($data['tag_groups'][$i]['id'] === $matches[1]) {
                if (!empty($input['name'])) {
                    // Handle multilingual name
                    if (is_array($input['name'])) {
                        $data['tag_groups'][$i]['name'] = [
                            'es' => sanitize($input['name']['es'] ?? ''),
                            'en' => sanitize($input['name']['en'] ?? '')
                        ];
                    } else {
                        $data['tag_groups'][$i]['name'] = sanitize($input['name']);
                    }
                }
                $updatedGroup = $data['tag_groups'][$i];
                $found = true;
                break;
            }
        }

        if (!$found) {
            response(['error' => t('tag.group_not_found')], 404);
        }

        writeJSON('categories.json', $data);
        response($updatedGroup);
        break;

    // PUT /admin/tags/{groupId}/{tagId} - Actualizar tag
    case preg_match('/^admin\/tags\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)$/', $path, $matches) && $method === 'PUT':
        checkAuth();
        $input = getInput();
        $groupId = $matches[1];
        $tagId = $matches[2];

        $data = readJSON('categories.json');
        $found = false;
        $updatedTag = null;

        // Buscar y actualizar sin referencias
        for ($i = 0; $i < count($data['tag_groups']); $i++) {
            if ($data['tag_groups'][$i]['id'] === $groupId) {
                for ($j = 0; $j < count($data['tag_groups'][$i]['tags']); $j++) {
                    if ($data['tag_groups'][$i]['tags'][$j]['id'] === $tagId) {
                        if (!empty($input['name'])) {
                            // Handle multilingual name
                            if (is_array($input['name'])) {
                                $data['tag_groups'][$i]['tags'][$j]['name'] = [
                                    'es' => sanitize($input['name']['es'] ?? ''),
                                    'en' => sanitize($input['name']['en'] ?? '')
                                ];
                            } else {
                                $data['tag_groups'][$i]['tags'][$j]['name'] = sanitize($input['name']);
                            }
                        }
                        $updatedTag = $data['tag_groups'][$i]['tags'][$j];
                        $found = true;
                        break 2;
                    }
                }
            }
        }

        if (!$found) {
            response(['error' => t('tag.not_found')], 404);
        }

        $writeResult = writeJSON('categories.json', $data);

        if (!$writeResult) {
            response(['error' => 'Failed to save changes'], 500);
        }

        response($updatedTag);
        break;

    // POST /admin/upload - Subir foto con tags
    case $path === 'admin/upload' && $method === 'POST':
        checkAuth();

        if (empty($_FILES['photos'])) {
            response(['error' => t('photo.no_files_uploaded')], 400);
        }

        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $maxSize = 5 * 1024 * 1024;

        // Obtener tags del POST
        $tags = [];
        if (!empty($_POST['tags'])) {
            if (is_array($_POST['tags'])) {
                $tags = $_POST['tags'];
            } else {
                $tags = array_map('trim', explode(',', $_POST['tags']));
            }
            $tags = array_filter($tags);
        }

        $data = readJSON('photos.json');
        $newPhotos = [];

        $files = [];
        if (is_array($_FILES['photos']['name'])) {
            for ($i = 0; $i < count($_FILES['photos']['name']); $i++) {
                $files[] = [
                    'name' => $_FILES['photos']['name'][$i],
                    'type' => $_FILES['photos']['type'][$i],
                    'tmp_name' => $_FILES['photos']['tmp_name'][$i],
                    'error' => $_FILES['photos']['error'][$i],
                    'size' => $_FILES['photos']['size'][$i]
                ];
            }
        } else {
            $files[] = $_FILES['photos'];
        }

        foreach ($files as $file) {
            if ($file['error'] !== UPLOAD_ERR_OK) continue;

            if (!in_array($file['type'], $allowedTypes)) {
                response(['error' => t('photo.file_type_not_allowed')], 400);
            }
            if ($file['size'] > $maxSize) {
                response(['error' => t('photo.file_too_large')], 400);
            }

            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = generateUUID() . '.' . strtolower($ext);
            $destination = UPLOADS_DIR . '/' . $filename;

            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                response(['error' => t('photo.save_error')], 500);
            }

            $newPhoto = [
                'id' => generateUUID(),
                'tags' => $tags,
                'url' => 'uploads/' . $filename,
                'text' => sanitize($_POST['text'] ?? ''),
                'created_at' => date('c')
            ];

            $newPhotos[] = $newPhoto;
            $data['photos'][] = $newPhoto;
        }

        // Guardar fotos en archivo general
        writeJSON('photos.json', $data);

        // Verificar si se debe agregar a un bucket existente
        $bucketId = $_POST['bucket_id'] ?? null;

        if (!empty($newPhotos)) {
            $bucketsData = readJSON('buckets.json');

            if ($bucketId) {
                // Agregar fotos a un bucket existente
                $bucketIndex = null;
                foreach ($bucketsData['buckets'] as $i => $bucket) {
                    if ($bucket['id'] === $bucketId) {
                        $bucketIndex = $i;
                        break;
                    }
                }

                if ($bucketIndex !== null) {
                    // Agregar nuevas fotos al bucket existente
                    $bucketsData['buckets'][$bucketIndex]['photos'] = array_merge(
                        $bucketsData['buckets'][$bucketIndex]['photos'],
                        $newPhotos
                    );
                    writeJSON('buckets.json', $bucketsData);
                    response(['photos' => $newPhotos, 'bucket_id' => $bucketId], 201);
                } else {
                    response(['error' => 'Bucket not found'], 404);
                }
            } else {
                // Crear nuevo bucket con estas fotos
                $newBucket = [
                    'id' => generateUUID(),
                    'created_at' => date('c'),
                    'photos' => $newPhotos
                ];

                // Agregar al inicio del array (más reciente primero)
                array_unshift($bucketsData['buckets'], $newBucket);

                // Mantener solo los últimos 5 buckets (FIFO)
                if (count($bucketsData['buckets']) > 5) {
                    $bucketsData['buckets'] = array_slice($bucketsData['buckets'], 0, 5);
                }

                writeJSON('buckets.json', $bucketsData);

                response(['photos' => $newPhotos, 'bucket_id' => $newBucket['id']], 201);
            }
        } else {
            response(['photos' => $newPhotos], 201);
        }
        break;

    // PUT /admin/photos/{id} - Actualizar foto (tags y texto)
    case preg_match('/^admin\/photos\/([a-zA-Z0-9-]+)$/', $path, $matches) && $method === 'PUT':
        checkAuth();
        $input = getInput();
        $data = readJSON('photos.json');

        $found = null;
        foreach ($data['photos'] as &$photo) {
            if ($photo['id'] === $matches[1]) {
                if (isset($input['text'])) {
                    $photo['text'] = sanitize($input['text']);
                }
                if (isset($input['tags'])) {
                    $photo['tags'] = is_array($input['tags']) ? $input['tags'] : [];
                }
                $photo['updated_at'] = date('c');
                $found = $photo;
                break;
            }
        }

        if (!$found) {
            response(['error' => t('photo.not_found')], 404);
        }

        writeJSON('photos.json', $data);
        response($found);
        break;

    // DELETE /admin/photos/{id}
    case preg_match('/^admin\/photos\/([a-zA-Z0-9-]+)$/', $path, $matches) && $method === 'DELETE':
        checkAuth();
        $data = readJSON('photos.json');

        $found = null;
        foreach ($data['photos'] as $key => $photo) {
            if ($photo['id'] === $matches[1]) {
                $found = $photo;
                $filepath = UPLOADS_DIR . '/' . basename($photo['url']);
                if (file_exists($filepath)) @unlink($filepath);
                unset($data['photos'][$key]);
                break;
            }
        }

        if (!$found) {
            response(['error' => t('photo.not_found')], 404);
        }

        $data['photos'] = array_values($data['photos']);
        writeJSON('photos.json', $data);
        response(['message' => t('photo.deleted')]);
        break;

    // POST /admin/photos/reorder - Reordenar fotos
    case $path === 'admin/photos/reorder' && $method === 'POST':
        checkAuth();
        $input = getInput();

        if (empty($input['photo_ids']) || !is_array($input['photo_ids'])) {
            response(['error' => 'photo_ids array is required'], 400);
        }

        $data = readJSON('photos.json');
        $newOrder = $input['photo_ids'];

        // Crear mapa de fotos por ID para búsqueda rápida
        $photoMap = [];
        foreach ($data['photos'] as $photo) {
            $photoMap[$photo['id']] = $photo;
        }

        // Reconstruir array de fotos en el nuevo orden
        $reorderedPhotos = [];
        foreach ($newOrder as $photoId) {
            if (isset($photoMap[$photoId])) {
                $reorderedPhotos[] = $photoMap[$photoId];
                unset($photoMap[$photoId]);
            }
        }

        // Agregar fotos que no estaban en la lista (por seguridad)
        foreach ($photoMap as $photo) {
            $reorderedPhotos[] = $photo;
        }

        // Verificar que no se hayan perdido fotos
        if (count($reorderedPhotos) !== count($data['photos'])) {
            response(['error' => 'Photo count mismatch'], 400);
        }

        $data['photos'] = $reorderedPhotos;
        writeJSON('photos.json', $data);
        response(['success' => true, 'message' => 'Photos reordered successfully']);
        break;

    // GET /config - Obtener configuración pública (logo, whatsapp, telegram, etc)
    case $path === 'config' && $method === 'GET':
        $lang = isset($_GET['lang']) ? $_GET['lang'] : 'es';
        if (!in_array($lang, ['es', 'en'])) {
            $lang = 'es';
        }

        $config = getConfig();
        $publicConfig = [];
        if (isset($config['logo'])) {
            $publicConfig['logo'] = $config['logo'];
        }
        if (isset($config['whatsapp'])) {
            $whatsapp = $config['whatsapp'];
            if (isset($whatsapp['message'])) {
                $whatsapp['message'] = transformConfigField($whatsapp['message'], $lang);
            }
            $publicConfig['whatsapp'] = $whatsapp;
        }
        if (isset($config['telegram'])) {
            $publicConfig['telegram'] = $config['telegram'];
        }
        if (isset($config['footer'])) {
            $footer = $config['footer'];
            if (isset($footer['website_text'])) {
                $footer['website_text'] = transformConfigField($footer['website_text'], $lang);
            }
            if (isset($footer['social_text'])) {
                $footer['social_text'] = transformConfigField($footer['social_text'], $lang);
            }
            $publicConfig['footer'] = $footer;
        }
        // Información del sitio (transformar según idioma)
        $publicConfig['site_title'] = transformConfigField($config['site_title'] ?? 'PEU Cuchillos Artesanales', $lang);
        $publicConfig['site_subtitle_mobile'] = transformConfigField($config['site_subtitle_mobile'] ?? 'Buscador interactivo', $lang);
        $publicConfig['site_subtitle_desktop'] = transformConfigField($config['site_subtitle_desktop'] ?? 'Buscador interactivo de modelos y materiales', $lang);
        $publicConfig['configurator_message'] = transformConfigField($config['configurator_message'] ?? 'Hola Pablo, te envío mi página del configurador de cuchillos: {link}', $lang);
        // Idiomas habilitados
        $publicConfig['enabled_languages'] = $config['enabled_languages'] ?? ['es' => true, 'en' => true];
        // Instrucciones flotantes
        if (isset($config['instructions'])) {
            $instructions = $config['instructions'];
            if (isset($instructions['title'])) {
                $instructions['title'] = transformConfigField($instructions['title'], $lang);
            }
            $publicConfig['instructions'] = $instructions;
        }
        // Título del login del backend
        if (isset($config['login_title'])) {
            $publicConfig['login_title'] = $config['login_title'];
        }
        // Carátula para previews
        if (isset($config['caratula'])) {
            $publicConfig['caratula'] = $config['caratula'];
        }
        // Instrucciones del configurador
        if (isset($config['configurator_instructions'])) {
            $configuratorInstructions = $config['configurator_instructions'];
            if (isset($configuratorInstructions['text'])) {
                $configuratorInstructions['text'] = transformConfigField($configuratorInstructions['text'], $lang);
            }
            $publicConfig['configurator_instructions'] = $configuratorInstructions;
        }
        // Configuración de headers (visibilidad)
        if (isset($config['headers'])) {
            $publicConfig['headers'] = $config['headers'];
        } else {
            $publicConfig['headers'] = ['showTypeGroups' => true, 'showSelectors' => true, 'showThumbnails' => true];
        }
        response($publicConfig);
        break;

    // GET /admin/backups - Listar backups disponibles
    case $path === 'admin/backups' && $method === 'GET':
        checkAuth();

        if (!is_dir(BACKUPS_DIR)) {
            mkdir(BACKUPS_DIR, 0755, true);
        }

        $files = array_diff(scandir(BACKUPS_DIR), ['.', '..']);
        $backups = [];
        foreach ($files as $file) {
            $ext = pathinfo($file, PATHINFO_EXTENSION);
            if ($ext === 'zip' || $ext === 'gz') { // Soportar ambos formatos
                $fullPath = BACKUPS_DIR . '/' . $file;
                $backups[] = [
                    'filename' => $file,
                    'size' => filesize($fullPath),
                    'created_at' => date('Y-m-d H:i:s', filemtime($fullPath))
                ];
            }
        }

        // Ordenar por fecha de creación descendente
        usort($backups, fn($a, $b) => strtotime($b['created_at']) - strtotime($a['created_at']));

        response(['backups' => $backups]);
        break;

    // POST /admin/backups - Crear nuevo backup
    case $path === 'admin/backups' && $method === 'POST':
        checkAuth();

        if (!is_dir(BACKUPS_DIR)) {
            mkdir(BACKUPS_DIR, 0755, true);
        }

        // Verificar límite de 5 backups
        $files = array_diff(scandir(BACKUPS_DIR), ['.', '..']);
        $existingBackups = array_filter($files, fn($f) => pathinfo($f, PATHINFO_EXTENSION) === 'zip');
        if (count($existingBackups) >= 5) {
            response(['error' => t('backup.limit_reached')], 400);
        }

        $timestamp = date('Y-m-d_His');
        $filename = "backup_{$timestamp}.zip";
        $backupPath = BACKUPS_DIR . '/' . $filename;

        // Verificar que las carpetas existan
        if (!is_dir(DATA_DIR)) {
            response(['error' => t('backup.data_folder_missing')], 500);
        }
        if (!is_dir(UPLOADS_DIR)) {
            response(['error' => t('backup.uploads_folder_missing')], 500);
        }

        // Crear ZIP usando ZipArchive (compatible con hosting compartido)
        if (!class_exists('ZipArchive')) {
            response(['error' => t('backup.ziparchive_unavailable')], 500);
        }

        $zip = new ZipArchive();
        if ($zip->open($backupPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            response(['error' => t('backup.create_failed')], 500);
        }

        // Función recursiva para agregar carpetas al ZIP
        $addFolderToZip = function($folder, $zipPath = '') use (&$addFolderToZip, $zip) {
            $files = scandir($folder);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..') continue;

                $fullPath = $folder . '/' . $file;
                $zipFilePath = $zipPath ? $zipPath . '/' . $file : $file;

                if (is_dir($fullPath)) {
                    $zip->addEmptyDir($zipFilePath);
                    $addFolderToZip($fullPath, $zipFilePath);
                } else {
                    $zip->addFile($fullPath, $zipFilePath);
                }
            }
        };

        // Agregar carpetas data y uploads al ZIP
        try {
            $zip->addEmptyDir('data');
            $addFolderToZip(DATA_DIR, 'data');

            $zip->addEmptyDir('uploads');
            $addFolderToZip(UPLOADS_DIR, 'uploads');

            $zip->close();
        } catch (Exception $e) {
            $zip->close();
            if (file_exists($backupPath)) {
                unlink($backupPath);
            }
            response(['error' => t('backup.create_error')], 500);
        }

        if (!file_exists($backupPath)) {
            response(['error' => t('backup.not_created')], 500);
        }

        response([
            'message' => t('backup.created'),
            'backup' => [
                'filename' => $filename,
                'size' => filesize($backupPath),
                'created_at' => date('Y-m-d H:i:s', filemtime($backupPath))
            ]
        ], 201);
        break;

    // GET /admin/backups/{filename} - Descargar backup
    case preg_match('/^admin\/backups\/([a-zA-Z0-9_\-\.]+)$/', $path, $matches) && $method === 'GET':
        checkAuth();

        $filename = $matches[1];
        // Validar que sea un archivo .zip o .tar.gz
        if (!preg_match('/^backup_[\d_-]+\.(zip|tar\.gz)$/', $filename)) {
            response(['error' => t('backup.invalid_filename')], 400);
        }

        $filePath = BACKUPS_DIR . '/' . $filename;
        if (!file_exists($filePath)) {
            response(['error' => t('backup.not_found')], 404);
        }

        // Enviar archivo para descarga
        $contentType = (pathinfo($filename, PATHINFO_EXTENSION) === 'zip') ? 'application/zip' : 'application/gzip';
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;

    // DELETE /admin/backups/{filename} - Eliminar backup
    case preg_match('/^admin\/backups\/([a-zA-Z0-9_\-\.]+)$/', $path, $matches) && $method === 'DELETE':
        checkAuth();

        $filename = $matches[1];
        // Validar que sea un archivo .zip o .tar.gz
        if (!preg_match('/^backup_[\d_-]+\.(zip|tar\.gz)$/', $filename)) {
            response(['error' => t('backup.invalid_filename')], 400);
        }

        $filePath = BACKUPS_DIR . '/' . $filename;
        if (!file_exists($filePath)) {
            response(['error' => t('backup.not_found')], 404);
        }

        if (!unlink($filePath)) {
            response(['error' => t('backup.delete_error')], 500);
        }

        response(['message' => t('backup.deleted')]);
        break;

    // POST /admin/config/logo - Subir logo del sitio
    case $path === 'admin/config/logo' && $method === 'POST':
        checkAuth();

        if (empty($_FILES['logo'])) {
            response(['error' => t('logo.no_file_uploaded')], 400);
        }

        $file = $_FILES['logo'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];

        if (!in_array($file['type'], $allowedTypes)) {
            response(['error' => t('logo.file_type_not_allowed')], 400);
        }

        if ($file['size'] > 2 * 1024 * 1024) { // 2MB max
            response(['error' => t('logo.file_too_large')], 400);
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'logo.' . strtolower($ext);
        $destination = UPLOADS_DIR . '/' . $filename;

        // Eliminar logo anterior si existe
        $config = getConfig();
        if (isset($config['logo'])) {
            $oldLogoPath = UPLOADS_DIR . '/' . basename($config['logo']);
            if (file_exists($oldLogoPath)) {
                unlink($oldLogoPath);
            }
        }

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            response(['error' => t('logo.save_error')], 500);
        }

        // Actualizar config
        $config['logo'] = 'uploads/' . $filename;
        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => t('logo.config_save_error')], 500);
        }

        response(['message' => t('logo.updated'), 'logo' => $config['logo']], 201);
        break;

    // DELETE /admin/config/logo - Eliminar logo del sitio
    case $path === 'admin/config/logo' && $method === 'DELETE':
        checkAuth();

        $config = getConfig();
        if (!isset($config['logo'])) {
            response(['error' => t('logo.not_configured')], 404);
        }

        $logoPath = UPLOADS_DIR . '/' . basename($config['logo']);
        if (file_exists($logoPath)) {
            unlink($logoPath);
        }

        unset($config['logo']);
        file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT));

        response(['message' => t('logo.deleted')]);
        break;

    // POST /admin/config/caratula - Subir carátula para previews
    case $path === 'admin/config/caratula' && $method === 'POST':
        checkAuth();

        if (empty($_FILES['caratula'])) {
            response(['error' => 'No se subió ningún archivo'], 400);
        }

        $file = $_FILES['caratula'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!in_array($file['type'], $allowedTypes)) {
            response(['error' => 'Tipo de archivo no permitido. Use JPG, PNG o WebP'], 400);
        }

        if ($file['size'] > 5 * 1024 * 1024) { // 5MB max
            response(['error' => 'El archivo es demasiado grande (máx 5MB)'], 400);
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'caratula.' . strtolower($ext);
        $destination = UPLOADS_DIR . '/' . $filename;

        // Eliminar carátula anterior si existe
        $config = getConfig();
        if (isset($config['caratula'])) {
            $oldCaratulaPath = UPLOADS_DIR . '/' . basename($config['caratula']);
            if (file_exists($oldCaratulaPath)) {
                unlink($oldCaratulaPath);
            }
        }

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            response(['error' => 'Error al guardar la carátula'], 500);
        }

        // Actualizar config
        $config['caratula'] = 'uploads/' . $filename;
        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => 'Error al guardar configuración'], 500);
        }

        response(['message' => 'Carátula actualizada', 'caratula' => $config['caratula']], 201);
        break;

    // DELETE /admin/config/caratula - Eliminar carátula
    case $path === 'admin/config/caratula' && $method === 'DELETE':
        checkAuth();

        $config = getConfig();
        if (!isset($config['caratula'])) {
            response(['error' => 'No hay carátula configurada'], 404);
        }

        $caratulaPath = UPLOADS_DIR . '/' . basename($config['caratula']);
        if (file_exists($caratulaPath)) {
            unlink($caratulaPath);
        }

        unset($config['caratula']);
        file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT));

        response(['message' => 'Carátula eliminada']);
        break;

    // POST /admin/config/contact - Configurar WhatsApp y Telegram
    case $path === 'admin/config/contact' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        // Validar y actualizar WhatsApp
        if (isset($input['whatsapp'])) {
            if (isset($input['whatsapp']['enabled'])) {
                if ($input['whatsapp']['enabled']) {
                    // Validar que tenga número y mensaje
                    if (empty($input['whatsapp']['number'])) {
                        response(['error' => t('contact.whatsapp_number_required')], 400);
                    }
                    if (empty($input['whatsapp']['message'])) {
                        response(['error' => t('contact.whatsapp_message_required')], 400);
                    }
                    $config['whatsapp'] = [
                        'enabled' => true,
                        'number' => $input['whatsapp']['number'],
                        'message' => $input['whatsapp']['message']
                    ];
                } else {
                    $config['whatsapp'] = ['enabled' => false];
                }
            }
        }

        // Validar y actualizar Telegram
        if (isset($input['telegram'])) {
            if (isset($input['telegram']['enabled'])) {
                if ($input['telegram']['enabled']) {
                    // Validar que tenga usuario y mensaje
                    if (empty($input['telegram']['username'])) {
                        response(['error' => t('contact.telegram_username_required')], 400);
                    }
                    if (empty($input['telegram']['message'])) {
                        response(['error' => t('contact.telegram_message_required')], 400);
                    }
                    $config['telegram'] = [
                        'enabled' => true,
                        'username' => $input['telegram']['username'],
                        'message' => $input['telegram']['message']
                    ];
                } else {
                    $config['telegram'] = ['enabled' => false];
                }
            }
        }

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => t('contact.config_save_error')], 500);
        }

        response(['message' => t('contact.config_updated')]);
        break;

    // GET /admin/config/contact - Obtener configuración de contacto
    case $path === 'admin/config/contact' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        $contactConfig = [
            'whatsapp' => $config['whatsapp'] ?? ['enabled' => false],
            'telegram' => $config['telegram'] ?? ['enabled' => false]
        ];

        response($contactConfig);
        break;

    // GET /admin/config/headers - Obtener configuración de headers
    case $path === 'admin/config/headers' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        $headersConfig = $config['headers'] ?? [
            'showTypeGroups' => true,
            'showSelectors' => true,
            'showThumbnails' => true
        ];

        response(['headers' => $headersConfig]);
        break;

    // POST /admin/config/headers - Configurar headers del frontend
    case $path === 'admin/config/headers' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['headers'])) {
            response(['error' => 'headers configuration is required'], 400);
        }

        $config['headers'] = $input['headers'];

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => 'Failed to save headers configuration'], 500);
        }

        response(['message' => 'Headers configuration updated successfully']);
        break;

    // POST /admin/config/metatags - Configurar metadatos HTML
    case $path === 'admin/config/metatags' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (isset($input['meta_tags'])) {
            $config['meta_tags'] = $input['meta_tags'];

            if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
                response(['error' => t('metadata.save_error')], 500);
            }

            // Modificar index.html directamente
            $indexPath = __DIR__ . '/../index.html';
            if (file_exists($indexPath)) {
                $html = file_get_contents($indexPath);

                // Remover metadatos anteriores si existen
                $html = preg_replace('/<!-- DYNAMIC META START -->.*?<!-- DYNAMIC META END -->/s', '', $html);

                // Construir metadatos a inyectar
                $metaTagsToInject = trim($input['meta_tags']);

                // Agregar og:image y twitter:image si hay carátula
                if (isset($config['caratula'])) {
                    $caratulaUrl = $config['caratula'];
                    // Convertir a URL absoluta si es relativa
                    if (!preg_match('/^https?:\/\//', $caratulaUrl)) {
                        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
                        $host = $_SERVER['HTTP_HOST'];
                        // Obtener el path base (por ejemplo /confi)
                        $basePath = dirname($_SERVER['SCRIPT_NAME'], 2);
                        // Construir URL sin dobles barras
                        if (!empty($basePath)) {
                            $caratulaUrl = "$protocol://$host$basePath/$caratulaUrl";
                        } else {
                            $caratulaUrl = "$protocol://$host/$caratulaUrl";
                        }
                    }

                    // Remover og:image y twitter:image existentes si los hay
                    $metaTagsToInject = preg_replace('/<meta[^>]*property=["\']og:image["\'][^>]*>/i', '', $metaTagsToInject);
                    $metaTagsToInject = preg_replace('/<meta[^>]*property=["\']twitter:image["\'][^>]*>/i', '', $metaTagsToInject);
                    $metaTagsToInject = preg_replace('/<meta[^>]*name=["\']twitter:image["\'][^>]*>/i', '', $metaTagsToInject);
                    $metaTagsToInject = trim($metaTagsToInject);

                    // Agregar og:image y twitter:image
                    $metaTagsToInject .= "\n<meta property=\"og:image\" content=\"$caratulaUrl\">";
                    $metaTagsToInject .= "\n<meta property=\"og:image:width\" content=\"1200\">";
                    $metaTagsToInject .= "\n<meta property=\"og:image:height\" content=\"630\">";
                    $metaTagsToInject .= "\n<meta name=\"twitter:image\" content=\"$caratulaUrl\">";
                }

                // Insertar nuevos metadatos antes de </head>
                if (!empty($metaTagsToInject)) {
                    $metaBlock = "\n    <!-- DYNAMIC META START -->\n    " .
                                 str_replace("\n", "\n    ", $metaTagsToInject) .
                                 "\n    <!-- DYNAMIC META END -->\n  ";
                    $html = str_replace('</head>', $metaBlock . '</head>', $html);
                }

                file_put_contents($indexPath, $html);
            }

            response(['message' => t('metadata.updated')]);
        } else {
            response(['error' => t('metadata.meta_tags_required')], 400);
        }
        break;

    // GET /admin/config/metatags - Obtener metadatos configurados
    case $path === 'admin/config/metatags' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        response(['meta_tags' => $config['meta_tags'] ?? '']);
        break;

    // POST /configurator/save - Guardar configuración del configurador
    case $path === 'configurator/save' && $method === 'POST':
        global $JSON_INPUT;
        $input = $JSON_INPUT;

        if (!isset($input['buckets']) || !is_array($input['buckets'])) {
            response(['error' => t('configurator.buckets_required')], 400);
        }

        // Si viene un código, usarlo (sobrescribir); si no, generar uno nuevo
        if (!empty($input['code'])) {
            $code = $input['code'];
        } else {
            $code = generateUniqueConfigCode();
        }

        $filepath = CONFIGURATOR_DIR . '/' . $code . '.json';

        // Leer created_at existente si es una actualización
        $created_at = date('Y-m-d H:i:s');
        if (file_exists($filepath)) {
            $existingData = json_decode(file_get_contents($filepath), true);
            if ($existingData && isset($existingData['created_at'])) {
                $created_at = $existingData['created_at'];
            }
        }

        // Guardar configuración
        $configData = [
            'code' => $code,
            'created_at' => $created_at,
            'updated_at' => date('Y-m-d H:i:s'),
            'buckets' => $input['buckets']
        ];

        if (!file_put_contents($filepath, json_encode($configData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
            response(['error' => t('configurator.save_error')], 500);
        }

        response(['code' => $code, 'message' => t('configurator.saved')], 201);
        break;

    // GET /configurator/:code - Cargar configuración por código
    case preg_match('/^configurator\/([A-Z0-9]{8,10})$/', $path, $matches) && $method === 'GET':
        $code = $matches[1];
        $filepath = CONFIGURATOR_DIR . '/' . $code . '.json';

        if (!file_exists($filepath)) {
            response(['error' => t('configurator.not_found')], 404);
        }

        $content = file_get_contents($filepath);
        $data = json_decode($content, true);

        if (!$data) {
            response(['error' => t('configurator.read_error')], 500);
        }

        response($data);
        break;

    // GET /admin/config/configurator - Obtener configuración de mensaje del configurador
    case $path === 'admin/config/configurator' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        $defaultMessage = [
            'es' => 'Hola Pablo, te envío mi página del configurador de cuchillos: {link}',
            'en' => 'Hi Pablo, here is my knife configurator page: {link}'
        ];
        response(['configurator_message' => $config['configurator_message'] ?? $defaultMessage]);
        break;

    // POST /admin/config/configurator - Guardar configuración de mensaje del configurador
    case $path === 'admin/config/configurator' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['configurator_message'])) {
            response(['error' => 'configurator_message parameter required'], 400);
        }

        $config['configurator_message'] = $input['configurator_message'];

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => t('configurator.save_error')], 500);
        }

        response(['message' => t('configurator.saved')]);
        break;

    // POST /admin/config/footer - Configurar footer
    case $path === 'admin/config/footer' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['footer'])) {
            response(['error' => t('footer.footer_required')], 400);
        }

        $config['footer'] = $input['footer'];

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => t('footer.save_error')], 500);
        }

        response(['message' => t('footer.updated')]);
        break;

    // GET /admin/config/footer - Obtener configuración del footer
    case $path === 'admin/config/footer' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        $footer = $config['footer'] ?? [
            'enabled' => false,
            'website_url' => '',
            'website_text' => ['es' => 'Visita mi página web', 'en' => 'Visit my website'],
            'social_text' => ['es' => 'Seguime en mis redes sociales', 'en' => 'Follow me on social media'],
            'instagram' => '',
            'twitter' => '',
            'facebook' => ''
        ];

        response(['footer' => $footer]);
        break;

    // POST /admin/config/instructions - Configurar instrucciones
    case $path === 'admin/config/instructions' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['instructions'])) {
            response(['error' => 'instructions configuration is required'], 400);
        }

        $config['instructions'] = $input['instructions'];

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => 'Failed to save instructions configuration'], 500);
        }

        response(['message' => 'Instructions updated']);
        break;

    // GET /admin/config/instructions - Obtener configuración de instrucciones
    case $path === 'admin/config/instructions' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        $instructions = $config['instructions'] ?? [
            'enabled' => false,
            'title' => 'Instrucciones',
            'text' => ''
        ];

        response(['instructions' => $instructions]);
        break;

    // GET /admin/config/configurator-instructions - Obtener instrucciones del configurador
    case $path === 'admin/config/configurator-instructions' && $method === 'GET':
        checkAuth();
        $config = getConfig();
        $configuratorInstructions = $config['configurator_instructions'] ?? [
            'enabled' => false,
            'text' => ''
        ];
        response(['configurator_instructions' => $configuratorInstructions]);
        break;

    // POST /admin/config/configurator-instructions - Guardar instrucciones del configurador
    case $path === 'admin/config/configurator-instructions' && $method === 'POST':
        checkAuth();
        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['configurator_instructions'])) {
            response(['error' => 'configurator_instructions configuration is required'], 400);
        }

        $config['configurator_instructions'] = $input['configurator_instructions'];
        saveConfig($config);
        response(['message' => 'Configurator instructions updated']);
        break;

    // POST /admin/config/site-info - Guardar información del sitio
    case $path === 'admin/config/site-info' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['site_title']) || !isset($input['site_subtitle_mobile']) || !isset($input['site_subtitle_desktop'])) {
            response(['error' => t('site_info.missing_params')], 400);
        }

        $config['site_title'] = $input['site_title'];
        $config['site_subtitle_mobile'] = $input['site_subtitle_mobile'];
        $config['site_subtitle_desktop'] = $input['site_subtitle_desktop'];
        if (isset($input['backend_title'])) {
            $config['backend_title'] = $input['backend_title'];
        }
        if (isset($input['login_title'])) {
            $config['login_title'] = $input['login_title'];
        }

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => t('site_info.save_error')], 500);
        }

        response(['message' => t('site_info.updated')]);
        break;

    // GET /admin/config/site-info - Obtener información del sitio
    case $path === 'admin/config/site-info' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        // Devolver los valores tal cual están (pueden ser strings o {es, en})
        $siteInfo = [
            'site_title' => $config['site_title'] ?? ['es' => 'PEU Cuchillos Artesanales', 'en' => 'PEU Artisan Knives'],
            'site_subtitle_mobile' => $config['site_subtitle_mobile'] ?? ['es' => 'Buscador interactivo', 'en' => 'Interactive search'],
            'site_subtitle_desktop' => $config['site_subtitle_desktop'] ?? ['es' => 'Buscador interactivo de modelos y materiales', 'en' => 'Interactive search for models and materials']
        ];
        if (isset($config['backend_title'])) {
            $siteInfo['backend_title'] = $config['backend_title'];
        }
        if (isset($config['login_title'])) {
            $siteInfo['login_title'] = $config['login_title'];
        }

        response($siteInfo);
        break;

    // POST /admin/config/languages - Guardar idiomas habilitados
    case $path === 'admin/config/languages' && $method === 'POST':
        checkAuth();

        global $JSON_INPUT;
        $input = $JSON_INPUT;
        $config = getConfig();

        if (!isset($input['enabled_languages']) || !is_array($input['enabled_languages'])) {
            response(['error' => 'enabled_languages is required and must be an object'], 400);
        }

        $enabledLangs = $input['enabled_languages'];

        // Validar que al menos un idioma esté habilitado
        if (empty($enabledLangs['es']) && empty($enabledLangs['en'])) {
            response(['error' => 'At least one language must be enabled'], 400);
        }

        $config['enabled_languages'] = [
            'es' => !empty($enabledLangs['es']),
            'en' => !empty($enabledLangs['en'])
        ];

        if (!file_put_contents(CONFIG_FILE, json_encode($config, JSON_PRETTY_PRINT))) {
            response(['error' => 'Failed to save language configuration'], 500);
        }

        response(['message' => 'Languages configuration updated successfully']);
        break;

    // GET /admin/config/languages - Obtener idiomas habilitados
    case $path === 'admin/config/languages' && $method === 'GET':
        checkAuth();

        $config = getConfig();
        $enabledLanguages = $config['enabled_languages'] ?? ['es' => true, 'en' => true];

        response(['enabled_languages' => $enabledLanguages]);
        break;

    default:
        response(['error' => t('general.route_not_found'), 'path' => $path], 404);
}
