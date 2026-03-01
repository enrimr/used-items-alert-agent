/** Traducciones en Español (idioma por defecto) */
module.exports = {
  lang: 'es',
  dir: 'ltr',

  // ── Página principal ──────────────────────────────────────────────────────
  page_title:        'Alertas de segunda mano — Recibe avisos de nuevos productos',
  page_description:  'Crea alertas gratuitas y recibe un email cuando aparezcan nuevos productos de segunda mano que cumplan tus criterios.',
  header_title:      '🔔 Alertas de Segunda Mano',
  header_subtitle:   'Recibe un email cuando aparezcan nuevos productos <b>sin reserva</b> que cumplan tu búsqueda',

  feature_email:    '📧 Email al instante',
  feature_no_reg:   '✨ Sin registro',
  feature_cancel:   '🗑️ Cancela cuando quieras',

  form_title:       '📬 Crear alerta',

  label_keywords:   '¿Qué buscas?',
  hint_required:    '(requerido)',
  placeholder_keywords: 'ej: iphone 13, ps5, bicicleta...',

  label_email:      'Tu email',
  placeholder_email: 'tuemail@ejemplo.com',

  label_min_price:  'Precio mínimo',
  hint_currency:    '(€)',
  label_max_price:  'Precio máximo',
  placeholder_max_price: 'sin límite',

  label_category:   'Categoría',
  hint_optional:    '(opcional)',
  option_all_categories: '— Todas las categorías —',

  label_frequency:  'Frecuencia de emails',
  option_immediate: '⚡ Inmediato — en cuanto aparezca algo',
  option_daily:     '📅 Resumen diario — una vez al día',
  option_weekly:    '📆 Resumen semanal — una vez a la semana',

  label_shipping:   '🚚 Solo productos <strong>con envío</strong>',

  webhook_label:    '🔗 Webhook / Integración',
  webhook_subtitle: '(Zapier, n8n, Slack…)',
  webhook_url_label:'URL del Webhook',
  webhook_url_hint: '(opcional)',
  webhook_placeholder: 'https://hooks.zapier.com/hooks/catch/…',
  webhook_description: 'Cuando se encuentren nuevos productos haremos un <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:11px;">POST</code> a esta URL con el JSON de los artículos. Compatible con <strong>Zapier</strong>, <strong>n8n</strong>, <strong>Make</strong>, <strong>Slack</strong> y cualquier servicio que acepte webhooks HTTP.',

  btn_submit:       '🔔 Crear alerta gratuita',
  btn_creating:     '⏳ Creando alerta...',
  note_no_spam:     'Sin registro · Sin spam · Cancela con un clic desde cualquier email',

  success_title:    '¡Alerta creada!',
  success_msg:      'Te avisaremos a <strong>{email}</strong> cuando aparezcan nuevos productos para "<strong>{keywords}</strong>".<br><br>Comprueba tu bandeja de entrada — te hemos enviado un email de confirmación.',
  back_link:        '← Crear otra alerta',

  error_keywords_short: 'Por favor escribe qué estás buscando',
  error_email_invalid:  'Por favor introduce un email válido',
  error_price_range:    'El precio mínimo no puede ser mayor que el máximo',
  error_generic:        'Error al crear la alerta. Inténtalo de nuevo.',
  error_connection:     'Error de conexión. Inténtalo de nuevo.',

  // ── Cómo funciona ────────────────────────────────────────────────────────
  how_step1_title: '1. Crea tu alerta',
  how_step1_desc:  'Pon tus palabras clave, precio y categoría',
  how_step2_title: '2. El agente busca',
  how_step2_desc:  'Monitoriza los anuncios cada pocos minutos',
  how_step3_title: '3. Recibe el email',
  how_step3_desc:  'Te avisamos al instante, sin spam',

  footer_text: 'Hecho con ❤️ · <a href="https://github.com/enrimr/used-items-alert-agent" target="_blank">GitHub</a> · MIT License',

  // ── Páginas simples ───────────────────────────────────────────────────────
  verify_invalid_title:   '❌ Enlace no válido',
  verify_invalid_msg:     'Este enlace de verificación no existe o ya fue utilizado.',
  verify_success_title:   '✅ ¡Email verificado!',
  verify_success_msg:     'Tu alerta para "<strong>{keywords}</strong>" está activa.<br><br>Te avisaremos en <strong>{email}</strong> cuando aparezcan nuevos productos.',
  verify_cta:             'Crear otra alerta',

  unsub_not_found_title:  '❌ Alerta no encontrada',
  unsub_not_found_msg:    'Esta alerta no existe o ya fue eliminada.',
  unsub_success_title:    '✅ Alerta eliminada',
  unsub_success_msg:      'Tu alerta para "<strong>{keywords}</strong>" ha sido eliminada correctamente.<br><br>Ya no recibirás más emails sobre esta búsqueda.',
  unsub_error_title:      'Error',
  unsub_error_msg:        'No se pudo eliminar la alerta. Inténtalo de nuevo.',

  // ── Página /success ───────────────────────────────────────────────────────
  success_page_title:     '✅ ¡Alerta creada! — Alertas',
  success_page_heading:   '✅ ¡Alerta creada!',
  success_page_msg:       'Recibirás un email en <strong>{email}</strong> cuando aparezcan nuevos productos para "<strong>{keywords}</strong>".',
  success_page_cta:       'Crear otra alerta',

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin_disabled_title:   'Admin desactivado',
  admin_disabled_msg:     'Configura ADMIN_PASSWORD en .env para activar el panel de administración.',
  admin_auth_required:    'Autenticación requerida',
  admin_wrong_password:   'Contraseña incorrecta',

  // ── Emails ────────────────────────────────────────────────────────────────
  email_confirmation_subject:    '✅ Alerta creada: "{keywords}" en Wallapop',
  email_confirmation_title:      '✅ Alerta creada',
  email_confirmation_subtitle:   'Te avisaremos cuando aparezcan nuevos productos',
  email_confirmation_intro:      'Tu alerta de Wallapop está activa:',
  email_confirmation_search:     'Búsqueda',
  email_confirmation_price:      'Precio',
  email_confirmation_email_lbl:  'Email',
  email_confirmation_unsub:      '❌ Eliminar esta alerta',

  email_verification_subject:    '✅ Confirma tu alerta: "{keywords}"',
  email_verification_title:      '📧 Confirma tu alerta',
  email_verification_subtitle:   'Un clic para activarla',
  email_verification_intro:      'Has creado una alerta para <strong>"{keywords}"</strong>.<br>Haz clic en el botón para confirmar tu email y activar la alerta:',
  email_verification_cta:        '✅ Confirmar y activar alerta',
  email_verification_disclaimer: 'Si no creaste esta alerta, ignora este email.<br>El enlace caduca en 48 horas.',
  email_verification_unsub:      '❌ Cancelar esta alerta',

  email_alert_subject:   '🆕 {count} nuevo{plural} en Wallapop: "{keywords}"{price_suffix}',
  email_alert_title:     '🔔 Alertas de Segunda Mano',
  email_alert_subtitle:  '{count} nuevo{plural} producto{plural} sin reserva',
  email_alert_view:      'Ver →',
  email_alert_footer:    'Recibes este email porque creaste una alerta en Wallapop Alertas.',
  email_alert_unsub:     '❌ Eliminar esta alerta',

  // ── Errores de API ────────────────────────────────────────────────────────
  api_email_required:    'Email y palabras clave son requeridos',
  api_email_invalid:     'Email no válido',
  api_keywords_short:    'Las palabras clave son demasiado cortas',
  api_price_min_not_valid: 'Precio mínimo no válido',
  api_price_max_not_valid: 'Precio máximo no válido',
  api_price_min_max:     'El precio mínimo no puede ser mayor que el máximo',
  api_limit_reached:     'Has alcanzado el límite de {limit} alerta{plural} activa{plural} para este email.',
  api_webhook_invalid:   'La URL del webhook debe comenzar con http:// o https://',
  api_internal_error:    'Error interno. Inténtalo de nuevo.',
  api_rate_limit:        'Demasiadas solicitudes. Espera unos minutos.',

  // ── Categorías ────────────────────────────────────────────────────────────
  cat_tecnologia:       'Tecnología',
  cat_moviles:          'Móviles y telefonía',
  cat_informatica:      'Informática',
  cat_moda:             'Moda y accesorios',
  cat_motor:            'Motor',
  cat_deporte:          'Deporte y ocio',
  cat_hogar:            'Hogar y jardín',
  cat_tv:               'Televisión y audio',
  cat_consolas:         'Consolas y videojuegos',
  cat_camaras:          'Cámaras y fotografía',
  cat_coleccionismo:    'Coleccionismo',
  cat_libros:           'Libros y música',
  cat_bebes:            'Bebés y niños',
  cat_otros:            'Otros',

  // ── Admin panel ───────────────────────────────────────────────────────────
  admin_title:              'Admin — Wallapop Alertas',
  admin_back_link:          '← Volver a la web',
  admin_stat_active:        'Alertas activas',
  admin_stat_total:         'Total alertas',
  admin_stat_users:         'Usuarios',
  admin_stat_emails_sent:   'Emails enviados',
  admin_stat_emails_failed: 'Emails fallidos',
  admin_stat_success_rate:  'Tasa de éxito',
  admin_stat_deleted:       'Eliminadas',
  admin_stat_seen:          'Productos vistos',
  admin_stat_pending:       '⏳ Pendientes verificar',

  admin_users_title:        '📧 Usuarios y límites',
  admin_users_active_toggle:'Con alertas activas',
  admin_users_col_email:    'Email',
  admin_users_col_alerts:   'Alertas activas / total',
  admin_users_col_sent:     'Emails enviados',
  admin_users_col_limit:    'Límite',

  admin_alerts_title:       '🔔 Alertas',
  admin_alerts_active_toggle: 'Solo activas',
  admin_alerts_search_ph:   '🔎 Buscar por palabras, email...',
  admin_alerts_freq_any:    'Cualquier frecuencia',
  admin_alerts_freq_imm:    '⚡ Inmediato',
  admin_alerts_freq_daily:  '📅 Diario',
  admin_alerts_freq_weekly: '📆 Semanal',
  admin_alerts_clear:       '✕ Limpiar',
  admin_col_status:         'Estado',
  admin_col_search:         'Búsqueda',
  admin_col_email:          'Email',
  admin_col_price:          'Precio',
  admin_col_category:       'Categoría',
  admin_col_frequency:      'Frecuencia',
  admin_col_webhook:        'Webhook',
  admin_col_created:        'Creada',
  admin_col_last_run:       'Último run',
  admin_col_emails:         'Emails',
  admin_col_action:         'Acción',

  admin_status_active:      'Activa',
  admin_status_inactive:    'Inactiva',
  admin_btn_deactivate:     'Desactivar',
  admin_btn_reactivate:     'Reactivar',
  admin_btn_delete:         '🗑️ Borrar',
  admin_confirm_deactivate: '¿Desactivar esta alerta?',
  admin_confirm_delete:     '¿Eliminar esta alerta?',
  admin_confirm_hard_delete:'⚠️ BORRADO DEFINITIVO: esta alerta y su historial se eliminarán permanentemente de la base de datos. ¿Continuar?',

  admin_empty_alerts:       'No hay alertas todavía',
  admin_empty_users:        'Sin usuarios todavía',
  admin_empty_data:         'Sin datos todavía',

  admin_badge_verified:     '✅ Verificada',
  admin_badge_pending:      '⏳ Pendiente',
  admin_webhook_on:         '🔗 ON',
  admin_webhook_off:        '— OFF',
  admin_edit_label:         'editar',
  admin_save_label:         'Guardar',
  admin_confirm_delete_webhook: '¿Eliminar webhook?',
  admin_active_of:          'activas de',
  admin_created_label:      'creadas',
  admin_max_label:          'Máx:',

  // ── Selector de idioma ────────────────────────────────────────────────────
  lang_select_label: 'Idioma',
};
