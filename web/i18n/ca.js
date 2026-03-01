/** Traduccions en Català */
module.exports = {
  lang: 'ca',
  dir: 'ltr',

  // ── Pàgina principal ──────────────────────────────────────────────────────
  page_title:        'Alertes de segona mà — Rep avisos de nous productes',
  page_description:  'Crea alertes gratuïtes i rep un email quan apareguin nous productes de segona mà que compleixin els teus criteris.',
  header_title:      '🔔 Alertes de Segona Mà',
  header_subtitle:   'Rep un email quan apareguin nous productes <b>sense reserva</b> que compleixin la teva cerca',

  feature_email:    '📧 Email a l\'instant',
  feature_no_reg:   '✨ Sense registre',
  feature_cancel:   '🗑️ Cancel·la quan vulguis',

  form_title:       '📬 Crear alerta',

  label_keywords:   'Què busques?',
  hint_required:    '(obligatori)',
  placeholder_keywords: 'ex: iphone 13, ps5, bicicleta...',

  label_email:      'El teu email',
  placeholder_email: 'elteuemail@exemple.com',

  label_min_price:  'Preu mínim',
  hint_currency:    '(€)',
  label_max_price:  'Preu màxim',
  placeholder_max_price: 'sense límit',

  label_category:   'Categoria',
  hint_optional:    '(opcional)',
  option_all_categories: '— Totes les categories —',

  label_frequency:  'Freqüència dels emails',
  option_immediate: '⚡ Immediat — tan aviat com aparegui alguna cosa',
  option_daily:     '📅 Resum diari — una vegada al dia',
  option_weekly:    '📆 Resum setmanal — una vegada a la setmana',

  label_shipping:   '🚚 Només productes <strong>amb enviament</strong>',

  webhook_label:    '🔗 Webhook / Integració',
  webhook_subtitle: '(Zapier, n8n, Slack…)',
  webhook_url_label:'URL del Webhook',
  webhook_url_hint: '(opcional)',
  webhook_placeholder: 'https://hooks.zapier.com/hooks/catch/…',
  webhook_description: 'Quan es trobin nous productes farem un <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:11px;">POST</code> a aquesta URL amb el JSON dels articles. Compatible amb <strong>Zapier</strong>, <strong>n8n</strong>, <strong>Make</strong>, <strong>Slack</strong> i qualsevol servei que accepti webhooks HTTP.',

  btn_submit:       '🔔 Crear alerta gratuïta',
  btn_creating:     '⏳ Creant alerta...',
  note_no_spam:     'Sense registre · Sense spam · Cancel·la amb un clic des de qualsevol email',

  success_title:    'Alerta creada!',
  success_msg:      'T\'avisarem a <strong>{email}</strong> quan apareguin nous productes per "<strong>{keywords}</strong>".<br><br>Comprova la teva safata d\'entrada — t\'hem enviat un email de confirmació.',
  back_link:        '← Crear una altra alerta',

  error_keywords_short: 'Si us plau escriu què estàs buscant',
  error_email_invalid:  'Si us plau introdueix un email vàlid',
  error_price_range:    'El preu mínim no pot ser major que el màxim',
  error_generic:        'Error en crear l\'alerta. Torna-ho a intentar.',
  error_connection:     'Error de connexió. Torna-ho a intentar.',

  // ── Com funciona ──────────────────────────────────────────────────────────
  how_step1_title: '1. Crea la teva alerta',
  how_step1_desc:  'Posa les teves paraules clau, preu i categoria',
  how_step2_title: '2. L\'agent cerca',
  how_step2_desc:  'Monitoritza els anuncis cada pocs minuts',
  how_step3_title: '3. Rep l\'email',
  how_step3_desc:  'T\'avisem a l\'instant, sense spam',

  footer_text: 'Fet amb ❤️ · <a href="https://github.com/enrimr/used-items-alert-agent" target="_blank">GitHub</a> · MIT License',

  // ── Pàgines simples ───────────────────────────────────────────────────────
  verify_invalid_title:   '❌ Enllaç no vàlid',
  verify_invalid_msg:     'Aquest enllaç de verificació no existeix o ja ha estat utilitzat.',
  verify_success_title:   '✅ Email verificat!',
  verify_success_msg:     'La teva alerta per "<strong>{keywords}</strong>" està activa.<br><br>T\'avisarem a <strong>{email}</strong> quan apareguin nous productes.',
  verify_cta:             'Crear una altra alerta',

  unsub_not_found_title:  '❌ Alerta no trobada',
  unsub_not_found_msg:    'Aquesta alerta no existeix o ja ha estat eliminada.',
  unsub_success_title:    '✅ Alerta eliminada',
  unsub_success_msg:      'La teva alerta per "<strong>{keywords}</strong>" ha estat eliminada correctament.<br><br>Ja no rebràs més emails sobre aquesta cerca.',
  unsub_error_title:      'Error',
  unsub_error_msg:        'No s\'ha pogut eliminar l\'alerta. Torna-ho a intentar.',

  // ── Pàgina /success ───────────────────────────────────────────────────────
  success_page_title:     '✅ Alerta creada! — Alertes',
  success_page_heading:   '✅ Alerta creada!',
  success_page_msg:       'Rebràs un email a <strong>{email}</strong> quan apareguin nous productes per "<strong>{keywords}</strong>".',
  success_page_cta:       'Crear una altra alerta',

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin_disabled_title:   'Admin desactivat',
  admin_disabled_msg:     'Configura ADMIN_PASSWORD a .env per activar el panell d\'administració.',
  admin_auth_required:    'Autenticació requerida',
  admin_wrong_password:   'Contrasenya incorrecta',

  // ── Emails ────────────────────────────────────────────────────────────────
  email_confirmation_subject:    '✅ Alerta creada: "{keywords}" a Wallapop',
  email_confirmation_title:      '✅ Alerta creada',
  email_confirmation_subtitle:   'T\'avisarem quan apareguin nous productes',
  email_confirmation_intro:      'La teva alerta de Wallapop està activa:',
  email_confirmation_search:     'Cerca',
  email_confirmation_price:      'Preu',
  email_confirmation_email_lbl:  'Email',
  email_confirmation_unsub:      '❌ Eliminar aquesta alerta',

  email_verification_subject:    '✅ Confirma la teva alerta: "{keywords}"',
  email_verification_title:      '📧 Confirma la teva alerta',
  email_verification_subtitle:   'Un clic per activar-la',
  email_verification_intro:      'Has creat una alerta per <strong>"{keywords}"</strong>.<br>Fes clic al botó per confirmar el teu email i activar l\'alerta:',
  email_verification_cta:        '✅ Confirmar i activar alerta',
  email_verification_disclaimer: 'Si no has creat aquesta alerta, ignora aquest email.<br>L\'enllaç caduca en 48 hores.',
  email_verification_unsub:      '❌ Cancel·lar aquesta alerta',

  email_alert_subject:   '🆕 {count} nou{plural} a Wallapop: "{keywords}"{price_suffix}',
  email_alert_title:     '🔔 Alertes de Segona Mà',
  email_alert_subtitle:  '{count} nou{plural} producte{plural} sense reserva',
  email_alert_view:      'Veure →',
  email_alert_footer:    'Reps aquest email perquè has creat una alerta a Wallapop Alertes.',
  email_alert_unsub:     '❌ Eliminar aquesta alerta',

  // ── Errors d'API ──────────────────────────────────────────────────────────
  api_email_required:    'L\'email i les paraules clau són obligatòries',
  api_email_invalid:     'Adreça d\'email no vàlida',
  api_keywords_short:    'Les paraules clau són massa curtes',
  api_price_min_not_valid: 'Preu mínim no vàlid',
  api_price_max_not_valid: 'Preu màxim no vàlid',
  api_price_min_max:     'El preu mínim no pot ser major que el màxim',
  api_limit_reached:     'Has assolit el límit de {limit} alerta{plural} activa{plural} per a aquest email.',
  api_webhook_invalid:   'La URL del webhook ha de començar amb http:// o https://',
  api_internal_error:    'Error intern. Torna-ho a intentar.',
  api_rate_limit:        'Massa sol·licituds. Espera uns minuts.',

  // ── Categories ────────────────────────────────────────────────────────────
  cat_tecnologia:       'Tecnologia',
  cat_moviles:          'Mòbils i telefonia',
  cat_informatica:      'Informàtica',
  cat_moda:             'Moda i accessoris',
  cat_motor:            'Motor',
  cat_deporte:          'Esport i oci',
  cat_hogar:            'Llar i jardí',
  cat_tv:               'Televisió i àudio',
  cat_consolas:         'Consoles i videojocs',
  cat_camaras:          'Càmeres i fotografia',
  cat_coleccionismo:    'Col·leccionisme',
  cat_libros:           'Llibres i música',
  cat_bebes:            'Bebès i nens',
  cat_otros:            'Altres',

  // ── Panell Admin ──────────────────────────────────────────────────────────
  admin_title:              'Admin — Wallapop Alertes',
  admin_back_link:          '← Tornar a la web',
  admin_stat_active:        'Alertes actives',
  admin_stat_total:         'Total alertes',
  admin_stat_users:         'Usuaris',
  admin_stat_emails_sent:   'Emails enviats',
  admin_stat_emails_failed: 'Emails fallits',
  admin_stat_success_rate:  'Taxa d\'èxit',
  admin_stat_deleted:       'Eliminades',
  admin_stat_seen:          'Productes vistos',
  admin_stat_pending:       '⏳ Pendents de verificar',

  admin_users_title:        '📧 Usuaris i límits',
  admin_users_active_toggle:'Amb alertes actives',
  admin_users_col_email:    'Email',
  admin_users_col_alerts:   'Alertes actives / total',
  admin_users_col_sent:     'Emails enviats',
  admin_users_col_limit:    'Límit',

  admin_alerts_title:       '🔔 Alertes',
  admin_alerts_active_toggle: 'Només actives',
  admin_alerts_search_ph:   '🔎 Cercar per paraules, email...',
  admin_alerts_freq_any:    'Qualsevol freqüència',
  admin_alerts_freq_imm:    '⚡ Immediat',
  admin_alerts_freq_daily:  '📅 Diari',
  admin_alerts_freq_weekly: '📆 Setmanal',
  admin_alerts_clear:       '✕ Netejar',
  admin_col_status:         'Estat',
  admin_col_search:         'Cerca',
  admin_col_email:          'Email',
  admin_col_price:          'Preu',
  admin_col_category:       'Categoria',
  admin_col_frequency:      'Freqüència',
  admin_col_webhook:        'Webhook',
  admin_col_created:        'Creada',
  admin_col_last_run:       'Últim run',
  admin_col_emails:         'Emails',
  admin_col_action:         'Acció',

  admin_status_active:      'Activa',
  admin_status_inactive:    'Inactiva',
  admin_btn_deactivate:     'Desactivar',
  admin_btn_reactivate:     'Reactivar',
  admin_btn_delete:         '🗑️ Esborrar',
  admin_confirm_deactivate: 'Desactivar aquesta alerta?',
  admin_confirm_delete:     'Eliminar aquesta alerta?',
  admin_confirm_hard_delete:'⚠️ ESBORRAMENT DEFINITIU: aquesta alerta i el seu historial s\'eliminaran permanentment de la base de dades. Continuar?',

  admin_empty_alerts:       'Encara no hi ha alertes',
  admin_empty_users:        'Encara no hi ha usuaris',
  admin_empty_data:         'Encara no hi ha dades',

  admin_badge_verified:     '✅ Verificada',
  admin_badge_pending:      '⏳ Pendent',
  admin_webhook_on:         '🔗 ON',
  admin_webhook_off:        '— OFF',
  admin_edit_label:         'editar',
  admin_save_label:         'Guardar',
  admin_confirm_delete_webhook: 'Eliminar el webhook?',
  admin_active_of:          'actives de',
  admin_created_label:      'creades',
  admin_max_label:          'Màx:',

  // ── Selector d'idioma ─────────────────────────────────────────────────────
  lang_select_label: 'Idioma',
};
