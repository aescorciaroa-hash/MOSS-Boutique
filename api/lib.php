<?php
declare(strict_types=1);

final class ApiError extends Exception
{
    public int $status;
    public function __construct(string $msg, int $status = 400)
    {
        parent::__construct($msg);
        $this->status = $status;
    }
}

function fail(string $msg, int $status = 400): never
{
    throw new ApiError($msg, $status);
}

// ---------------------------------------------------------------- Configuración
// Busca la configuración fuera de la carpeta pública (lo recomendado en Hostinger)
// y, si no existe, junto a la API (solo para desarrollo local).
function config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $candidates = [
        dirname(__DIR__, 2) . '/moss-config.php',   // /home/usuario/domains/tu-dominio/moss-config.php
        dirname(__DIR__) . '/../moss-config.php',
        __DIR__ . '/config.local.php',              // desarrollo (no se sube a GitHub)
    ];
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $cfg = require $file;
            return $cfg;
        }
    }
    fail('Falta el archivo de configuración moss-config.php en el servidor.', 500);
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config();
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['db_host'] ?? 'localhost', (int)($c['db_port'] ?? 3306), $c['db_name']);
    $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS moss_users (
        id VARCHAR(40) PRIMARY KEY,
        username VARCHAR(60) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(120) NOT NULL,
        role VARCHAR(16) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        customer_id VARCHAR(40) NULL,
        created_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS moss_docs (
        seq BIGINT AUTO_INCREMENT PRIMARY KEY,
        coll VARCHAR(20) NOT NULL,
        id VARCHAR(64) NOT NULL,
        data LONGTEXT NOT NULL,
        UNIQUE KEY coll_id (coll, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS moss_meta (
        k VARCHAR(40) PRIMARY KEY,
        v LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

// ---------------------------------------------------------------- Utilidades
function uid(string $prefix = ''): string
{
    return $prefix . base_convert((string)(int)(microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(3));
}
function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s.v\Z');
}
function digits(?string $s): string
{
    return preg_replace('/\D+/', '', (string)$s);
}
function str_in(array $in, string $k, int $max = 200): string
{
    return mb_substr(trim((string)($in[$k] ?? '')), 0, $max);
}

const COLLS = ['products', 'customers', 'sales', 'movements'];

function docs(PDO $pdo, string $coll): array
{
    $st = $pdo->prepare('SELECT data FROM moss_docs WHERE coll = ? ORDER BY seq DESC');
    $st->execute([$coll]);
    return array_map(fn($r) => json_decode($r['data'], true), $st->fetchAll());
}
function doc_get(PDO $pdo, string $coll, string $id, bool $lock = false): ?array
{
    $st = $pdo->prepare('SELECT data FROM moss_docs WHERE coll = ? AND id = ?' . ($lock ? ' FOR UPDATE' : ''));
    $st->execute([$coll, $id]);
    $r = $st->fetch();
    return $r ? json_decode($r['data'], true) : null;
}
function doc_put(PDO $pdo, string $coll, array $row): void
{
    if (empty($row['id'])) fail('Registro sin id');
    $st = $pdo->prepare('INSERT INTO moss_docs (coll, id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)');
    $st->execute([$coll, (string)$row['id'], json_encode($row, JSON_UNESCAPED_UNICODE)]);
}
function doc_del(PDO $pdo, string $coll, string $id): void
{
    $pdo->prepare('DELETE FROM moss_docs WHERE coll = ? AND id = ?')->execute([$coll, $id]);
}
function meta_get(PDO $pdo, string $k, $default = null, bool $lock = false)
{
    $st = $pdo->prepare('SELECT v FROM moss_meta WHERE k = ?' . ($lock ? ' FOR UPDATE' : ''));
    $st->execute([$k]);
    $r = $st->fetch();
    return $r ? json_decode($r['v'], true) : $default;
}
function meta_set(PDO $pdo, string $k, $v): void
{
    $pdo->prepare('INSERT INTO moss_meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')
        ->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE)]);
}
function settings(PDO $pdo): array
{
    $s = meta_get($pdo, 'settings', []) ?: [];
    $s['nextSaleNumber'] = (int)meta_get($pdo, 'next_sale_number', 1);
    return $s;
}

// ---------------------------------------------------------------- Sesión y permisos
function start_session(): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('moss_sid');
    session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
function public_user(array $u): array
{
    return [
        'id' => $u['id'], 'name' => $u['name'], 'username' => $u['username'], 'role' => $u['role'],
        'active' => (bool)$u['active'], 'customerId' => $u['customer_id'], 'createdAt' => $u['created_at'],
    ];
}
function current_user(PDO $pdo): ?array
{
    $id = $_SESSION['uid'] ?? null;
    if (!$id) return null;
    $st = $pdo->prepare('SELECT * FROM moss_users WHERE id = ? AND active = 1');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}
function require_user(PDO $pdo, ?string $role = null): array
{
    $u = current_user($pdo);
    if (!$u) fail('Tu sesión terminó. Vuelve a iniciar sesión.', 401);
    if ($role && $u['role'] !== $role) fail('No tienes permiso para esta acción.', 403);
    return $u;
}
function find_user_by_username(PDO $pdo, string $username): ?array
{
    $st = $pdo->prepare('SELECT * FROM moss_users WHERE LOWER(username) = LOWER(?)');
    $st->execute([$username]);
    return $st->fetch() ?: null;
}
function admin_exists(PDO $pdo): bool
{
    return (bool)$pdo->query("SELECT 1 FROM moss_users WHERE role = 'admin' AND active = 1 LIMIT 1")->fetch();
}
function doc_taken(PDO $pdo, string $doc, ?string $exceptCustomerId): bool
{
    if ($doc === '') return false;
    $ids = $pdo->query("SELECT customer_id FROM moss_users WHERE customer_id IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $cid) {
        if ($cid === $exceptCustomerId) continue;
        $c = doc_get($pdo, 'customers', $cid);
        if ($c && digits($c['doc'] ?? '') === $doc) return true;
    }
    return false;
}
function linked_customer_ids(PDO $pdo): array
{
    return $pdo->query("SELECT customer_id FROM moss_users WHERE customer_id IS NOT NULL AND role = 'cliente'")->fetchAll(PDO::FETCH_COLUMN);
}

// ---------------------------------------------------------------- Estado por rol
function strip_cost(array $p): array
{
    unset($p['cost']);
    return $p;
}
function build_state(PDO $pdo): array
{
    $u = current_user($pdo);
    $settings = settings($pdo);
    $products = docs($pdo, 'products');
    $out = [
        'needsSetup' => !admin_exists($pdo),
        'user' => $u ? public_user($u) : null,
        'settings' => $settings,
        'products' => [], 'customers' => [], 'sales' => [], 'movements' => [], 'users' => [],
    ];
    if ($u && $u['role'] === 'admin') {
        $out['products'] = $products;
        $out['customers'] = docs($pdo, 'customers');
        $out['sales'] = docs($pdo, 'sales');
        $out['movements'] = docs($pdo, 'movements');
        $out['users'] = array_map('public_user', $pdo->query('SELECT * FROM moss_users ORDER BY created_at')->fetchAll());
        return $out;
    }
    // Visitantes y clientes: solo catálogo (sin costos)
    $out['products'] = array_map('strip_cost', $products);
    if ($u) {
        $cid = $u['customer_id'];
        $me = $cid ? doc_get($pdo, 'customers', $cid) : null;
        $out['customers'] = $me ? [$me] : [];
        $sales = $cid ? array_values(array_filter(docs($pdo, 'sales'), fn($s) => ($s['customerId'] ?? null) === $cid)) : [];
        $out['sales'] = array_map(function ($s) {
            $s['items'] = array_map(fn($i) => strip_cost($i), $s['items'] ?? []);
            return $s;
        }, $sales);
        // Nombres de quienes atendieron sus pedidos (para la factura)
        $sellerIds = array_values(array_unique(array_filter(array_map(fn($s) => $s['sellerId'] ?? null, $sales))));
        $users = [public_user($u)];
        if ($sellerIds) {
            $in = implode(',', array_fill(0, count($sellerIds), '?'));
            $st = $pdo->prepare("SELECT id, name, role FROM moss_users WHERE id IN ($in)");
            $st->execute($sellerIds);
            foreach ($st->fetchAll() as $s) if ($s['id'] !== $u['id']) $users[] = ['id' => $s['id'], 'name' => $s['name'], 'role' => $s['role'], 'active' => true];
        }
        $out['users'] = $users;
    }
    return $out;
}

// ---------------------------------------------------------------- Acciones públicas
function act_state(PDO $pdo, array $in): array
{
    return ['state' => build_state($pdo)];
}

function validate_password(string $p): void
{
    if (mb_strlen($p) < 8) fail('La contraseña debe tener al menos 8 caracteres.');
}
function validate_username(string $u): void
{
    if (!preg_match('/^[a-zA-Z0-9._-]{3,40}$/', $u)) fail('El usuario debe tener entre 3 y 40 caracteres, sin espacios.');
}

function act_setup(PDO $pdo, array $in): array
{
    $pdo->beginTransaction();
    try {
        if ($pdo->query("SELECT 1 FROM moss_users WHERE role = 'admin' LIMIT 1 FOR UPDATE")->fetch()) fail('El sistema ya fue configurado.', 409);
        $name = str_in($in, 'name', 120);
        $username = strtolower(str_in($in, 'username', 40));
        $password = (string)($in['password'] ?? '');
        if (mb_strlen($name) < 3) fail('Escribe tu nombre completo.');
        validate_username($username);
        validate_password($password);
        $id = uid('u');
        $pdo->prepare('INSERT INTO moss_users (id, username, password_hash, name, role, active, customer_id, created_at) VALUES (?, ?, ?, ?, ?, 1, NULL, ?)')
            ->execute([$id, $username, password_hash($password, PASSWORD_DEFAULT), $name, 'admin', now_iso()]);
        // Catálogo inicial (solo si la base está vacía) y configuración por defecto
        $hasProducts = (bool)$pdo->query("SELECT 1 FROM moss_docs WHERE coll = 'products' LIMIT 1")->fetch();
        if (!$hasProducts && is_array($in['catalog'] ?? null)) {
            foreach (array_reverse($in['catalog']) as $p) if (is_array($p) && !empty($p['id'])) doc_put($pdo, 'products', $p);
        }
        if (meta_get($pdo, 'settings') === null && is_array($in['settings'] ?? null)) {
            $s = $in['settings'];
            unset($s['nextSaleNumber']);
            meta_set($pdo, 'settings', $s);
            meta_set($pdo, 'next_sale_number', 1);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    return ['state' => build_state($pdo)];
}

function act_login(PDO $pdo, array $in): array
{
    $u = find_user_by_username($pdo, str_in($in, 'username', 60));
    if (!$u || !$u['active'] || !password_verify((string)($in['password'] ?? ''), $u['password_hash'])) {
        usleep(600000); // frena intentos repetidos
        fail('Usuario o contraseña incorrectos', 401);
    }
    if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE moss_users SET password_hash = ? WHERE id = ?')->execute([password_hash((string)$in['password'], PASSWORD_DEFAULT), $u['id']]);
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    return ['state' => build_state($pdo)];
}

function act_logout(PDO $pdo, array $in): array
{
    $_SESSION = [];
    session_destroy();
    return ['state' => build_state($pdo)];
}

function customer_fields(array $in): array
{
    return [
        'name' => str_in($in, 'name', 120),
        'doc' => digits(str_in($in, 'doc', 20)),
        'phone' => str_in($in, 'phone', 30),
        'email' => str_in($in, 'email', 120),
        'city' => str_in($in, 'city', 80),
        'address' => str_in($in, 'address', 200),
    ];
}
function validate_customer(array $f, bool $docRequired): void
{
    if (mb_strlen($f['name']) < 3) fail('Escribe tu nombre completo.');
    if ($docRequired && !preg_match('/^\d{6,10}$/', $f['doc'])) fail('Escribe tu número de cédula (6 a 10 dígitos).');
    if (strlen(digits($f['phone'])) < 7) fail('Escribe un celular válido.');
    if ($f['email'] !== '' && !filter_var($f['email'], FILTER_VALIDATE_EMAIL)) fail('El correo no es válido.');
}

function act_register(PDO $pdo, array $in): array
{
    $username = strtolower(str_in($in, 'username', 40));
    $password = (string)($in['password'] ?? '');
    $f = customer_fields($in);
    validate_username($username);
    validate_password($password);
    validate_customer($f, true);
    $pdo->beginTransaction();
    try {
        if (find_user_by_username($pdo, $username)) fail('Ese usuario ya existe. Elige otro.', 409);
        if (doc_taken($pdo, $f['doc'], null)) fail('Ya existe una cuenta con esa cédula.', 409);
        $now = now_iso();
        $customer = ['id' => uid('c')] + $f + ['notes' => 'Registrada desde la tienda en línea', 'createdAt' => $now];
        doc_put($pdo, 'customers', $customer);
        $id = uid('u');
        $pdo->prepare('INSERT INTO moss_users (id, username, password_hash, name, role, active, customer_id, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
            ->execute([$id, $username, password_hash($password, PASSWORD_DEFAULT), $f['name'], 'cliente', $customer['id'], $now]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    return ['state' => build_state($pdo)];
}

// ---------------------------------------------------------------- Cliente
function act_update_profile(PDO $pdo, array $in): array
{
    $u = require_user($pdo, 'cliente');
    $f = customer_fields($in);
    validate_customer($f, true);
    $pdo->beginTransaction();
    try {
        $cid = $u['customer_id'];
        if (doc_taken($pdo, $f['doc'], $cid)) fail('Esa cédula ya está registrada en otra cuenta.', 409);
        $c = $cid ? doc_get($pdo, 'customers', $cid, true) : null;
        if ($c) {
            $c = array_merge($c, $f);
        } else {
            $c = ['id' => uid('c')] + $f + ['notes' => 'Registrada desde la tienda en línea', 'createdAt' => now_iso()];
            $cid = $c['id'];
        }
        doc_put($pdo, 'customers', $c);
        $pdo->prepare('UPDATE moss_users SET name = ?, customer_id = ? WHERE id = ?')->execute([$f['name'], $cid, $u['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}

const ONLINE_METHODS = ['transferencia', 'nequi', 'daviplata', 'efectivo'];

function act_place_order(PDO $pdo, array $in): array
{
    $u = require_user($pdo, 'cliente');
    $lines = $in['items'] ?? [];
    if (!is_array($lines) || !$lines || count($lines) > 60) fail('Tu carrito está vacío.');
    $method = (string)($in['method'] ?? '');
    if (!in_array($method, ONLINE_METHODS, true)) fail('Medio de pago no válido.');
    $delivery = ($in['delivery'] ?? '') === 'tienda' ? 'tienda' : 'envio';
    $phone = str_in($in, 'phone', 30);
    $address = str_in($in, 'address', 200);
    $city = str_in($in, 'city', 80);
    $noteIn = str_in($in, 'note', 300);
    if (strlen(digits($phone)) < 7) fail('Escribe un celular para confirmar tu pedido.');
    if ($delivery === 'envio' && mb_strlen($address) < 5) fail('Escribe la dirección de entrega.');

    $pdo->beginTransaction();
    try {
        // Cliente
        $cid = $u['customer_id'];
        $c = $cid ? doc_get($pdo, 'customers', $cid, true) : null;
        if (!$c) {
            $c = ['id' => uid('c'), 'name' => $u['name'], 'doc' => '', 'phone' => '', 'email' => '', 'city' => '', 'address' => '', 'notes' => 'Cliente de la tienda en línea', 'createdAt' => now_iso()];
            $cid = $c['id'];
            $pdo->prepare('UPDATE moss_users SET customer_id = ? WHERE id = ?')->execute([$cid, $u['id']]);
        }
        $c['phone'] = $phone ?: ($c['phone'] ?? '');
        if ($city !== '') $c['city'] = $city;
        if ($address !== '') $c['address'] = $address;
        doc_put($pdo, 'customers', $c);

        // Precios y stock se toman del servidor, nunca del navegador
        $items = [];
        $products = [];
        $now = now_iso();
        foreach ($lines as $l) {
            $pid = (string)($l['productId'] ?? '');
            $vid = (string)($l['variantId'] ?? '');
            $qty = (int)($l['qty'] ?? 0);
            if ($qty < 1 || $qty > 100) fail('Cantidad no válida.');
            if (!isset($products[$pid])) {
                $p = doc_get($pdo, 'products', $pid, true);
                if (!$p || empty($p['active'])) fail('Uno de los productos ya no está disponible.', 409);
                $products[$pid] = $p;
            }
            $p = &$products[$pid];
            $found = false;
            foreach ($p['variants'] as &$v) {
                if ($v['id'] !== $vid) continue;
                $found = true;
                if ((int)$v['stock'] < $qty) {
                    fail(sprintf('No hay unidades suficientes de %s %s (%s%s). Ajusta tu carrito.', $p['type'] ?? '', $p['name'] ?? '', $v['color'] ?? '', ($v['size'] ?? '') !== 'Única' ? ' · Talla ' . ($v['size'] ?? '') : ''), 409);
                }
                $v['stock'] = (int)$v['stock'] - $qty;
                $items[] = [
                    'productId' => $pid, 'variantId' => $vid, 'sku' => $p['sku'] ?? '', 'name' => trim(($p['type'] ?? '') . ' ' . ($p['name'] ?? '')),
                    'image' => $p['image'] ?? null, 'color' => $v['color'] ?? '', 'size' => $v['size'] ?? '', 'qty' => $qty,
                    'price' => (int)$p['price'], 'cost' => (int)($p['cost'] ?? 0),
                ];
            }
            unset($v, $p);
            if (!$found) fail('Una de las tallas o colores ya no está disponible.', 409);
        }

        $settings = settings($pdo);
        $number = (int)meta_get($pdo, 'next_sale_number', 1, true);
        $subtotal = array_sum(array_map(fn($i) => $i['qty'] * $i['price'], $items));
        $tax = (int)round($subtotal * ((float)($settings['taxRate'] ?? 0) / 100));
        $total = $subtotal + $tax;
        $deliveryText = $delivery === 'envio' ? 'Envío a domicilio: ' . $address . ($city !== '' ? ', ' . $city : '') : 'Recoge en tienda';
        $sale = [
            'id' => uid('s'), 'number' => $number, 'date' => $now, 'items' => $items,
            'subtotal' => $subtotal, 'discount' => 0, 'tax' => $tax, 'total' => $total,
            'payments' => [['method' => $method, 'amount' => $total]], 'received' => $total, 'change' => 0,
            'customerId' => $cid, 'sellerId' => null, 'status' => 'pendiente', 'voidReason' => null,
            'note' => implode(' · ', array_filter([$deliveryText, $phone ? 'Tel: ' . $phone : '', $noteIn])),
            'channel' => 'Tienda en línea',
        ];
        foreach ($products as $p) doc_put($pdo, 'products', $p);
        doc_put($pdo, 'sales', $sale);
        foreach ($items as $i) {
            doc_put($pdo, 'movements', ['id' => uid('m'), 'date' => $now, 'productId' => $i['productId'], 'variantId' => $i['variantId'], 'qty' => -$i['qty'], 'type' => 'venta', 'reason' => "Pedido en línea #$number", 'userId' => $u['id']]);
        }
        meta_set($pdo, 'next_sale_number', $number + 1);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    $sale['items'] = array_map('strip_cost', $sale['items']);
    return ['sale' => $sale, 'state' => build_state($pdo)];
}

// ---------------------------------------------------------------- Administrador
function act_sync(PDO $pdo, array $in): array
{
    require_user($pdo, 'admin');
    $allowed = ['products', 'customers'];
    $linked = linked_customer_ids($pdo);
    $pdo->beginTransaction();
    try {
        foreach (($in['upsert'] ?? []) as $coll => $rows) {
            if (!in_array($coll, $allowed, true) || !is_array($rows)) fail('Colección no permitida.');
            foreach ($rows as $row) {
                if (!is_array($row) || empty($row['id'])) continue;
                if ($coll === 'customers' && in_array($row['id'], $linked, true)) {
                    // La cédula de un cliente con cuenta solo la cambia el propio cliente.
                    $old = doc_get($pdo, 'customers', (string)$row['id'], true);
                    $row['doc'] = $old['doc'] ?? '';
                }
                if ($coll === 'products') {
                    // El stock no se pisa desde aquí si cambió en el servidor mientras se editaba (pedidos en línea).
                    $old = doc_get($pdo, 'products', (string)$row['id'], true);
                    if ($old && isset($row['_baseStock']) && is_array($row['_baseStock'])) {
                        $oldStock = [];
                        foreach ($old['variants'] as $v) $oldStock[$v['id']] = (int)$v['stock'];
                        foreach ($row['variants'] as &$v) {
                            $base = $row['_baseStock'][$v['id']] ?? null;
                            if ($base !== null && isset($oldStock[$v['id']])) $v['stock'] = max(0, $oldStock[$v['id']] + ((int)$v['stock'] - (int)$base));
                        }
                        unset($v);
                    }
                    unset($row['_baseStock']);
                }
                doc_put($pdo, $coll, $row);
            }
        }
        foreach (($in['delete'] ?? []) as $coll => $ids) {
            if (!in_array($coll, $allowed, true) || !is_array($ids)) fail('Colección no permitida.');
            foreach ($ids as $id) {
                if ($coll === 'customers' && in_array($id, $linked, true)) fail('No puedes eliminar un cliente que tiene cuenta en la tienda.');
                doc_del($pdo, $coll, (string)$id);
            }
        }
        if (is_array($in['settings'] ?? null)) {
            $s = array_merge(meta_get($pdo, 'settings', []) ?: [], $in['settings']);
            unset($s['nextSaleNumber']);
            meta_set($pdo, 'settings', $s);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}

function act_confirm_order(PDO $pdo, array $in): array
{
    $u = require_user($pdo, 'admin');
    $pdo->beginTransaction();
    try {
        $s = doc_get($pdo, 'sales', (string)($in['id'] ?? ''), true);
        if (!$s) fail('El pedido no existe.', 404);
        if ($s['status'] !== 'pendiente') fail('Este pedido ya fue procesado.', 409);
        $s['status'] = 'completada';
        $s['confirmedAt'] = now_iso();
        $s['sellerId'] = $u['id'];
        doc_put($pdo, 'sales', $s);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}

function change_stock(PDO $pdo, string $pid, string $vid, int $delta): void
{
    $p = doc_get($pdo, 'products', $pid, true);
    if (!$p) return; // producto eliminado: se conserva la venta
    foreach ($p['variants'] as &$v) if ($v['id'] === $vid) $v['stock'] = max(0, (int)$v['stock'] + $delta);
    unset($v);
    doc_put($pdo, 'products', $p);
}

function act_void_sale(PDO $pdo, array $in): array
{
    $u = require_user($pdo, 'admin');
    $reason = str_in($in, 'reason', 200) ?: 'Sin motivo';
    $pdo->beginTransaction();
    try {
        $s = doc_get($pdo, 'sales', (string)($in['id'] ?? ''), true);
        if (!$s) fail('La venta no existe.', 404);
        if ($s['status'] === 'anulada') fail('Esta venta ya estaba anulada.', 409);
        $now = now_iso();
        foreach ($s['items'] as $i) {
            change_stock($pdo, $i['productId'], $i['variantId'], (int)$i['qty']);
            doc_put($pdo, 'movements', ['id' => uid('m'), 'date' => $now, 'productId' => $i['productId'], 'variantId' => $i['variantId'], 'qty' => (int)$i['qty'], 'type' => 'anulación', 'reason' => "Anulación venta #{$s['number']}: $reason", 'userId' => $u['id']]);
        }
        $s['status'] = 'anulada';
        $s['voidReason'] = $reason;
        $s['voidedAt'] = $now;
        $s['voidedBy'] = $u['id'];
        doc_put($pdo, 'sales', $s);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}

function act_adjust_stock(PDO $pdo, array $in): array
{
    $u = require_user($pdo, 'admin');
    $pid = (string)($in['productId'] ?? '');
    $vid = (string)($in['variantId'] ?? '');
    $qty = (int)($in['qty'] ?? 0);
    $type = str_in($in, 'type', 30) ?: 'ajuste';
    $pdo->beginTransaction();
    try {
        if (!doc_get($pdo, 'products', $pid, true)) fail('El producto no existe.', 404);
        change_stock($pdo, $pid, $vid, $qty);
        doc_put($pdo, 'movements', ['id' => uid('m'), 'date' => now_iso(), 'productId' => $pid, 'variantId' => $vid, 'qty' => $qty, 'type' => $type, 'reason' => str_in($in, 'reason', 200), 'userId' => $u['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}

function act_save_user(PDO $pdo, array $in): array
{
    $me = require_user($pdo, 'admin');
    $id = (string)($in['id'] ?? '');
    $name = str_in($in, 'name', 120);
    $username = strtolower(str_in($in, 'username', 40));
    $role = ($in['role'] ?? '') === 'admin' ? 'admin' : 'cliente';
    $active = !empty($in['active']) ? 1 : 0;
    $password = (string)($in['password'] ?? '');
    if ($name === '') fail('Escribe el nombre.');
    validate_username($username);
    $other = find_user_by_username($pdo, $username);
    if ($other && $other['id'] !== $id) fail('Ese usuario ya existe.', 409);
    if ($id && $id === $me['id'] && ($role !== 'admin' || !$active)) fail('No puedes quitarte el rol de administrador ni desactivarte.');
    if ($id) {
        $st = $pdo->prepare('SELECT * FROM moss_users WHERE id = ?');
        $st->execute([$id]);
        if (!$st->fetch()) fail('El usuario no existe.', 404);
        if ($password !== '') {
            validate_password($password);
            $pdo->prepare('UPDATE moss_users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
        }
        $pdo->prepare('UPDATE moss_users SET name = ?, username = ?, role = ?, active = ? WHERE id = ?')->execute([$name, $username, $role, $active, $id]);
    } else {
        validate_password($password);
        $pdo->prepare('INSERT INTO moss_users (id, username, password_hash, name, role, active, customer_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)')
            ->execute([uid('u'), $username, password_hash($password, PASSWORD_DEFAULT), $name, $role, $active, now_iso()]);
    }
    return ['state' => build_state($pdo)];
}

function act_delete_user(PDO $pdo, array $in): array
{
    $me = require_user($pdo, 'admin');
    $id = (string)($in['id'] ?? '');
    if ($id === $me['id']) fail('No puedes eliminar tu propio usuario.');
    $pdo->prepare('DELETE FROM moss_users WHERE id = ?')->execute([$id]);
    return ['state' => build_state($pdo)];
}

function act_clear_data(PDO $pdo, array $in): array
{
    require_user($pdo, 'admin');
    $pdo->beginTransaction();
    try {
        $pdo->exec("DELETE FROM moss_docs WHERE coll IN ('sales', 'movements')");
        // Conserva las fichas de los clientes que tienen cuenta en la tienda
        $linked = linked_customer_ids($pdo);
        foreach (docs($pdo, 'customers') as $c) if (!in_array($c['id'], $linked, true)) doc_del($pdo, 'customers', $c['id']);
        meta_set($pdo, 'next_sale_number', 1);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}

function act_export_data(PDO $pdo, array $in): array
{
    require_user($pdo, 'admin');
    $out = ['version' => 2, 'exportedAt' => now_iso(), 'settings' => settings($pdo)];
    foreach (COLLS as $c) $out[$c] = docs($pdo, $c);
    $out['users'] = array_map('public_user', $pdo->query('SELECT * FROM moss_users')->fetchAll());
    return ['data' => $out];
}

function act_import_data(PDO $pdo, array $in): array
{
    require_user($pdo, 'admin');
    $d = $in['data'] ?? null;
    if (!is_array($d) || !is_array($d['products'] ?? null) || !is_array($d['sales'] ?? null)) fail('El archivo no tiene el formato de respaldo de MOSS.');
    $pdo->beginTransaction();
    try {
        foreach (COLLS as $c) {
            $pdo->prepare('DELETE FROM moss_docs WHERE coll = ?')->execute([$c]);
            foreach (array_reverse(is_array($d[$c] ?? null) ? $d[$c] : []) as $row) if (is_array($row) && !empty($row['id'])) doc_put($pdo, $c, $row);
        }
        if (is_array($d['settings'] ?? null)) {
            $s = $d['settings'];
            $next = (int)($s['nextSaleNumber'] ?? 0);
            unset($s['nextSaleNumber']);
            meta_set($pdo, 'settings', $s);
            $max = 0;
            foreach ($d['sales'] as $sale) $max = max($max, (int)($sale['number'] ?? 0));
            meta_set($pdo, 'next_sale_number', max($next, $max + 1, 1));
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return ['state' => build_state($pdo)];
}
