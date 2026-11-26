<?php
/**
 * MOSS Boutique · API (PHP + MySQL)
 *
 * Un solo punto de entrada: POST /api/index.php  { "action": "...", ...datos }
 * Respuesta: { "ok": true, ... } o { "ok": false, "error": "mensaje" }
 *
 * Seguridad:
 *  - Contraseñas con password_hash (nunca se envían al navegador).
 *  - Sesión PHP en cookie HttpOnly + SameSite=Lax; las acciones exigen la cabecera X-Moss.
 *  - Cada rol recibe solo sus datos: el cliente ve su perfil, sus pedidos y el catálogo.
 *  - Stock, pedidos y anulaciones se procesan aquí, dentro de transacciones.
 */
declare(strict_types=1);

require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Método no permitido', 405);
    if (($_SERVER['HTTP_X_MOSS'] ?? '') !== '1') fail('Solicitud no válida', 400);

    start_session();
    $in = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($in)) fail('JSON no válido', 400);
    $action = (string)($in['action'] ?? '');

    $pdo = db();
    ensure_schema($pdo);

    $routes = [
        // Públicas
        'state'          => 'act_state',
        'setup'          => 'act_setup',
        'login'          => 'act_login',
        'logout'         => 'act_logout',
        'register'       => 'act_register',
        // Cliente con sesión
        'placeOrder'     => 'act_place_order',
        'updateProfile'  => 'act_update_profile',
        // Administrador
        'sync'           => 'act_sync',
        'confirmOrder'   => 'act_confirm_order',
        'voidSale'       => 'act_void_sale',
        'adjustStock'    => 'act_adjust_stock',
        'saveUser'       => 'act_save_user',
        'deleteUser'     => 'act_delete_user',
        'clearData'      => 'act_clear_data',
        'importData'     => 'act_import_data',
        'exportData'     => 'act_export_data',
    ];
    if (!isset($routes[$action])) fail('Acción desconocida', 404);
    $out = $routes[$action]($pdo, $in);
    echo json_encode(['ok' => true] + $out, JSON_UNESCAPED_UNICODE);
} catch (ApiError $e) {
    http_response_code($e->status);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[moss] ' . $e->getMessage() . ' @' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error del servidor. Intenta de nuevo.'], JSON_UNESCAPED_UNICODE);
}
