<?php
/**
 * Plugin Name: Energize Build Tool
 * Description: REST endpoints used by the Energize Build Tool to create Elementor pages and set brand styling on client sites. Must-use plugin, copied with full site duplication.
 * Version: 1.0.0
 * Author: Energize Group
 *
 * Install: place at /wp-content/mu-plugins/energize-build-tool.php on the blank
 * WP template install. Define the shared secret in wp-config.php:
 *
 *   define('ENERGIZE_BUILD_SECRET', 'your-shared-secret');
 *
 * All endpoints live under /wp-json/energize/v1/ and require a matching
 * X-Energize-Secret header. POST only.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('ENERGIZE_BUILD_TABLE_VERSION')) {
    define('ENERGIZE_BUILD_TABLE_VERSION', '1');
}

/**
 * Name of the auth-failure log table.
 */
function energize_build_log_table() {
    global $wpdb;
    return $wpdb->prefix . 'energize_build_auth_log';
}

/**
 * Create the auth-failure log table once. mu-plugins have no activation hook,
 * so this runs on init guarded by a stored version option.
 */
function energize_build_maybe_create_table() {
    if (get_option('energize_build_table_version') === ENERGIZE_BUILD_TABLE_VERSION) {
        return;
    }
    global $wpdb;
    $table = energize_build_log_table();
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE {$table} (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        occurred_at DATETIME NOT NULL,
        ip VARCHAR(100) NOT NULL,
        route VARCHAR(191) NOT NULL,
        reason VARCHAR(191) NOT NULL,
        PRIMARY KEY  (id)
    ) {$charset};";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
    update_option('energize_build_table_version', ENERGIZE_BUILD_TABLE_VERSION);
}
add_action('init', 'energize_build_maybe_create_table');

/**
 * Record an auth failure for monitoring.
 */
function energize_build_log_auth_failure($route, $reason) {
    global $wpdb;
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    $wpdb->insert(
        energize_build_log_table(),
        array(
            'occurred_at' => current_time('mysql'),
            'ip'          => substr($ip, 0, 100),
            'route'       => substr($route, 0, 191),
            'reason'      => substr($reason, 0, 191),
        ),
        array('%s', '%s', '%s', '%s')
    );
}

/**
 * Shared-secret permission callback for every endpoint.
 */
function energize_build_check_secret(WP_REST_Request $request) {
    $route = $request->get_route();

    if (!defined('ENERGIZE_BUILD_SECRET') || ENERGIZE_BUILD_SECRET === '') {
        energize_build_log_auth_failure($route, 'secret_not_configured');
        return new WP_Error(
            'energize_secret_missing',
            'Server is not configured with ENERGIZE_BUILD_SECRET.',
            array('status' => 500)
        );
    }

    $provided = $request->get_header('x-energize-secret');
    if (!is_string($provided) || !hash_equals(ENERGIZE_BUILD_SECRET, $provided)) {
        energize_build_log_auth_failure($route, 'bad_or_missing_secret');
        return new WP_Error(
            'energize_unauthorized',
            'Invalid or missing X-Energize-Secret header.',
            array('status' => 401)
        );
    }

    return true;
}

/**
 * Register all routes.
 */
add_action('rest_api_init', function () {
    $args = array(
        'methods'             => 'POST',
        'permission_callback' => 'energize_build_check_secret',
    );

    register_rest_route('energize/v1', '/page', array_merge($args, array(
        'callback' => 'energize_build_create_page',
    )));
    register_rest_route('energize/v1', '/brand-colors', array_merge($args, array(
        'callback' => 'energize_build_set_brand_colors',
    )));
    register_rest_route('energize/v1', '/brand-fonts', array_merge($args, array(
        'callback' => 'energize_build_set_brand_fonts',
    )));
    register_rest_route('energize/v1', '/logo', array_merge($args, array(
        'callback' => 'energize_build_set_logo',
    )));
    register_rest_route('energize/v1', '/favicon', array_merge($args, array(
        'callback' => 'energize_build_set_favicon',
    )));
    register_rest_route('energize/v1', '/flush-css', array_merge($args, array(
        'callback' => 'energize_build_flush_css',
    )));
});

/**
 * POST /page
 * Body: { title, slug?, template?, elementor_data (JSON string or array),
 *         elementor_version?, status? }
 * Writes the Elementor data and all related meta server-side.
 */
function energize_build_create_page(WP_REST_Request $request) {
    $title = sanitize_text_field((string) $request->get_param('title'));
    if ($title === '') {
        return new WP_Error('energize_bad_input', 'title is required.', array('status' => 400));
    }

    $slug             = sanitize_title((string) $request->get_param('slug'));
    $template         = sanitize_text_field((string) $request->get_param('template'));
    $elementor_version = sanitize_text_field((string) $request->get_param('elementor_version'));
    $status           = (string) $request->get_param('status');
    $status           = in_array($status, array('draft', 'pending', 'private'), true) ? $status : 'draft';

    // Accept the Elementor data either as an already-stringified JSON or as a
    // decoded array/object, and normalize to a JSON string.
    $raw_data = $request->get_param('elementor_data');
    if (is_string($raw_data)) {
        $decoded = json_decode($raw_data, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('energize_bad_input', 'elementor_data is not valid JSON.', array('status' => 400));
        }
        $data_array = $decoded;
    } elseif (is_array($raw_data)) {
        $data_array = $raw_data;
    } else {
        return new WP_Error('energize_bad_input', 'elementor_data is required.', array('status' => 400));
    }

    if (!is_array($data_array)) {
        return new WP_Error('energize_bad_input', 'elementor_data must be an array of elements.', array('status' => 400));
    }

    $postarr = array(
        'post_title'  => $title,
        'post_status' => $status,
        'post_type'   => 'page',
    );
    if ($slug !== '') {
        $postarr['post_name'] = $slug;
    }

    $post_id = wp_insert_post($postarr, true);
    if (is_wp_error($post_id)) {
        return new WP_Error('energize_insert_failed', $post_id->get_error_message(), array('status' => 500));
    }

    // Store Elementor data the same way Elementor itself does (slashed JSON).
    $json = wp_json_encode($data_array);
    update_post_meta($post_id, '_elementor_data', wp_slash($json));
    update_post_meta($post_id, '_elementor_edit_mode', 'builder');
    update_post_meta($post_id, '_elementor_template_type', 'wp-page');
    if ($elementor_version !== '') {
        update_post_meta($post_id, '_elementor_version', $elementor_version);
    }
    if ($template !== '') {
        update_post_meta($post_id, '_wp_page_template', $template);
    }

    return new WP_REST_Response(array(
        'ok'       => true,
        'id'       => $post_id,
        'slug'     => get_post_field('post_name', $post_id),
        'status'   => get_post_status($post_id),
        'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
        'view_url' => get_permalink($post_id),
    ), 200);
}

/**
 * Load the active Elementor kit post ID, or WP_Error if none.
 */
function energize_build_active_kit_id() {
    $kit_id = (int) get_option('elementor_active_kit');
    if ($kit_id <= 0 || get_post_status($kit_id) === false) {
        return new WP_Error('energize_no_kit', 'No active Elementor kit found on this site.', array('status' => 500));
    }
    return $kit_id;
}

/**
 * Merge keys into the active kit page settings and save.
 */
function energize_build_update_kit_settings(array $changes) {
    $kit_id = energize_build_active_kit_id();
    if (is_wp_error($kit_id)) {
        return $kit_id;
    }
    $settings = get_post_meta($kit_id, '_elementor_page_settings', true);
    if (!is_array($settings)) {
        $settings = array();
    }
    foreach ($changes as $key => $value) {
        $settings[$key] = $value;
    }
    update_post_meta($kit_id, '_elementor_page_settings', $settings);
    return $kit_id;
}

/**
 * Sanitize an incoming color list into Elementor's expected shape.
 */
function energize_build_sanitize_colors($list) {
    $out = array();
    if (!is_array($list)) {
        return $out;
    }
    foreach ($list as $item) {
        if (!is_array($item)) {
            continue;
        }
        $entry = array(
            '_id'   => isset($item['_id']) ? sanitize_text_field((string) $item['_id']) : substr(md5(wp_json_encode($item) . wp_rand()), 0, 7),
            'title' => isset($item['title']) ? sanitize_text_field((string) $item['title']) : '',
            'color' => isset($item['color']) ? sanitize_hex_color((string) $item['color']) : '',
        );
        if ($entry['color']) {
            $out[] = $entry;
        }
    }
    return $out;
}

/**
 * POST /brand-colors
 * Body: { system_colors: [...], custom_colors?: [...] }
 */
function energize_build_set_brand_colors(WP_REST_Request $request) {
    $system = energize_build_sanitize_colors($request->get_param('system_colors'));
    $custom = energize_build_sanitize_colors($request->get_param('custom_colors'));

    if (empty($system) && empty($custom)) {
        return new WP_Error('energize_bad_input', 'Provide system_colors and/or custom_colors.', array('status' => 400));
    }

    $changes = array();
    if (!empty($system)) {
        $changes['system_colors'] = $system;
    }
    if (!empty($custom)) {
        $changes['custom_colors'] = $custom;
    }

    $result = energize_build_update_kit_settings($changes);
    if (is_wp_error($result)) {
        return $result;
    }

    return new WP_REST_Response(array(
        'ok'             => true,
        'system_colors'  => count($system),
        'custom_colors'  => count($custom),
    ), 200);
}

/**
 * Sanitize a typography list. Each entry keeps its _id, title and any
 * typography_* keys (font family, weight, etc.).
 */
function energize_build_sanitize_typography($list) {
    $out = array();
    if (!is_array($list)) {
        return $out;
    }
    foreach ($list as $item) {
        if (!is_array($item)) {
            continue;
        }
        $entry = array(
            '_id'   => isset($item['_id']) ? sanitize_text_field((string) $item['_id']) : substr(md5(wp_json_encode($item) . wp_rand()), 0, 7),
            'title' => isset($item['title']) ? sanitize_text_field((string) $item['title']) : '',
        );
        foreach ($item as $key => $value) {
            if (strpos((string) $key, 'typography_') === 0) {
                $entry[$key] = sanitize_text_field((string) $value);
            }
        }
        $out[] = $entry;
    }
    return $out;
}

/**
 * POST /brand-fonts
 * Body: { system_typography: [...], custom_typography?: [...] }
 */
function energize_build_set_brand_fonts(WP_REST_Request $request) {
    $system = energize_build_sanitize_typography($request->get_param('system_typography'));
    $custom = energize_build_sanitize_typography($request->get_param('custom_typography'));

    if (empty($system) && empty($custom)) {
        return new WP_Error('energize_bad_input', 'Provide system_typography and/or custom_typography.', array('status' => 400));
    }

    $changes = array();
    if (!empty($system)) {
        $changes['system_typography'] = $system;
    }
    if (!empty($custom)) {
        $changes['custom_typography'] = $custom;
    }

    $result = energize_build_update_kit_settings($changes);
    if (is_wp_error($result)) {
        return $result;
    }

    return new WP_REST_Response(array(
        'ok'                  => true,
        'system_typography'   => count($system),
        'custom_typography'   => count($custom),
    ), 200);
}

/**
 * Decode a base64 payload and store it in the media library.
 * Returns attachment ID or WP_Error.
 */
function energize_build_store_media($base64, $filename, array $allowed_ext) {
    if (!is_string($base64) || $base64 === '') {
        return new WP_Error('energize_bad_input', 'file (base64) is required.', array('status' => 400));
    }
    // Strip a data URI prefix if present.
    if (strpos($base64, 'base64,') !== false) {
        $base64 = substr($base64, strpos($base64, 'base64,') + 7);
    }
    $binary = base64_decode($base64, true);
    if ($binary === false) {
        return new WP_Error('energize_bad_input', 'file is not valid base64.', array('status' => 400));
    }

    $filename = sanitize_file_name($filename);
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed_ext, true)) {
        return new WP_Error('energize_bad_input', 'Unsupported file type: ' . $ext, array('status' => 400));
    }

    $upload = wp_upload_bits($filename, null, $binary);
    if (!empty($upload['error'])) {
        return new WP_Error('energize_upload_failed', $upload['error'], array('status' => 500));
    }

    $filetype = wp_check_filetype($upload['file']);
    $attachment = array(
        'post_mime_type' => $filetype['type'] ? $filetype['type'] : 'application/octet-stream',
        'post_title'     => sanitize_text_field(pathinfo($filename, PATHINFO_FILENAME)),
        'post_content'   => '',
        'post_status'    => 'inherit',
    );
    $attach_id = wp_insert_attachment($attachment, $upload['file']);
    if (is_wp_error($attach_id)) {
        return $attach_id;
    }

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $metadata = wp_generate_attachment_metadata($attach_id, $upload['file']);
    wp_update_attachment_metadata($attach_id, $metadata);

    return $attach_id;
}

/**
 * POST /logo
 * Body: { file (base64), filename }
 */
function energize_build_set_logo(WP_REST_Request $request) {
    $attach_id = energize_build_store_media(
        (string) $request->get_param('file'),
        (string) $request->get_param('filename') ?: 'logo.png',
        array('png', 'jpg', 'jpeg', 'svg')
    );
    if (is_wp_error($attach_id)) {
        return $attach_id;
    }
    set_theme_mod('custom_logo', $attach_id);
    return new WP_REST_Response(array(
        'ok'            => true,
        'attachment_id' => $attach_id,
        'url'           => wp_get_attachment_url($attach_id),
    ), 200);
}

/**
 * POST /favicon
 * Body: { file (base64), filename }
 */
function energize_build_set_favicon(WP_REST_Request $request) {
    $attach_id = energize_build_store_media(
        (string) $request->get_param('file'),
        (string) $request->get_param('filename') ?: 'favicon.png',
        array('png', 'ico')
    );
    if (is_wp_error($attach_id)) {
        return $attach_id;
    }
    update_option('site_icon', $attach_id);
    return new WP_REST_Response(array(
        'ok'            => true,
        'attachment_id' => $attach_id,
        'url'           => wp_get_attachment_url($attach_id),
    ), 200);
}

/**
 * POST /flush-css
 * Regenerate Elementor CSS (equivalent to: wp elementor flush_css).
 */
function energize_build_flush_css(WP_REST_Request $request) {
    if (!class_exists('\\Elementor\\Plugin')) {
        return new WP_Error('energize_no_elementor', 'Elementor is not active on this site.', array('status' => 500));
    }
    $plugin = \Elementor\Plugin::$instance;
    if (isset($plugin->files_manager)) {
        $plugin->files_manager->clear_cache();
        return new WP_REST_Response(array('ok' => true, 'flushed' => true), 200);
    }
    return new WP_Error('energize_flush_failed', 'Elementor files manager unavailable.', array('status' => 500));
}
