/** Traduzioni in Italiano */
module.exports = {
  lang: 'it',
  dir: 'ltr',

  // ── Pagina principale ─────────────────────────────────────────────────────
  page_title:        'Avvisi di seconda mano — Ricevi notifiche per nuovi prodotti',
  page_description:  'Crea avvisi gratuiti e ricevi un\'email quando appaiono nuovi prodotti di seconda mano che corrispondono ai tuoi criteri.',
  header_title:      '🔔 Avvisi di Seconda Mano',
  header_subtitle:   'Ricevi un\'email quando appaiono nuovi prodotti <b>disponibili</b> che corrispondono alla tua ricerca',

  feature_email:    '📧 Email istantanea',
  feature_no_reg:   '✨ Senza registrazione',
  feature_cancel:   '🗑️ Cancella quando vuoi',

  form_title:       '📬 Crea avviso',

  label_keywords:   'Cosa cerchi?',
  hint_required:    '(obbligatorio)',
  placeholder_keywords: 'es: iphone 13, ps5, bicicletta...',

  label_email:      'La tua email',
  placeholder_email: 'tuaemail@esempio.com',

  label_min_price:  'Prezzo minimo',
  hint_currency:    '(€)',
  label_max_price:  'Prezzo massimo',
  placeholder_max_price: 'senza limite',

  label_category:   'Categoria',
  hint_optional:    '(opzionale)',
  option_all_categories: '— Tutte le categorie —',

  label_frequency:  'Frequenza delle email',
  option_immediate: '⚡ Immediato — non appena appare qualcosa',
  option_daily:     '📅 Riepilogo giornaliero — una volta al giorno',
  option_weekly:    '📆 Riepilogo settimanale — una volta alla settimana',

  label_shipping:   '🚚 Solo prodotti <strong>con spedizione</strong>',

  webhook_label:    '🔗 Webhook / Integrazione',
  webhook_subtitle: '(Zapier, n8n, Slack…)',
  webhook_url_label:'URL Webhook',
  webhook_url_hint: '(opzionale)',
  webhook_placeholder: 'https://hooks.zapier.com/hooks/catch/…',
  webhook_description: 'Quando vengono trovati nuovi prodotti, invieremo una <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:11px;">POST</code> a questo URL con il JSON degli articoli. Compatibile con <strong>Zapier</strong>, <strong>n8n</strong>, <strong>Make</strong>, <strong>Slack</strong> e qualsiasi servizio che accetti webhook HTTP.',

  btn_submit:       '🔔 Crea avviso gratuito',
  btn_creating:     '⏳ Creazione avviso...',
  note_no_spam:     'Nessuna registrazione · Nessuno spam · Cancella con un clic da qualsiasi email',

  success_title:    'Avviso creato!',
  success_msg:      'Notificheremo <strong>{email}</strong> quando appariranno nuovi prodotti per "<strong>{keywords}</strong>".<br><br>Controlla la tua casella di posta — ti abbiamo inviato un\'email di conferma.',
  back_link:        '← Crea un altro avviso',

  error_keywords_short: 'Inserisci cosa stai cercando',
  error_email_invalid:  'Inserisci un indirizzo email valido',
  error_price_range:    'Il prezzo minimo non può essere maggiore del massimo',
  error_generic:        'Errore durante la creazione dell\'avviso. Riprova.',
  error_connection:     'Errore di connessione. Riprova.',

  // ── Come funziona ─────────────────────────────────────────────────────────
  how_step1_title: '1. Crea il tuo avviso',
  how_step1_desc:  'Inserisci le tue parole chiave, prezzo e categoria',
  how_step2_title: '2. L\'agente cerca',
  how_step2_desc:  'Monitora gli annunci ogni pochi minuti',
  how_step3_title: '3. Ricevi l\'email',
  how_step3_desc:  'Ti avvisiamo all\'istante, senza spam',

  footer_text: 'Fatto con ❤️ · <a href="https://github.com/enrimr/used-items-alert-agent" target="_blank">GitHub</a> · MIT License',

  // ── Pagine semplici ───────────────────────────────────────────────────────
  verify_invalid_title:   '❌ Link non valido',
  verify_invalid_msg:     'Questo link di verifica non esiste o è già stato utilizzato.',
  verify_success_title:   '✅ Email verificata!',
  verify_success_msg:     'Il tuo avviso per "<strong>{keywords}</strong>" è attivo.<br><br>Notificheremo <strong>{email}</strong> quando appariranno nuovi prodotti.',
  verify_cta:             'Crea un altro avviso',

  unsub_not_found_title:  '❌ Avviso non trovato',
  unsub_not_found_msg:    'Questo avviso non esiste o è già stato eliminato.',
  unsub_success_title:    '✅ Avviso eliminato',
  unsub_success_msg:      'Il tuo avviso per "<strong>{keywords}</strong>" è stato eliminato con successo.<br><br>Non riceverai più email su questa ricerca.',
  unsub_error_title:      'Errore',
  unsub_error_msg:        'Impossibile eliminare l\'avviso. Riprova.',

  // ── Pagina /success ───────────────────────────────────────────────────────
  success_page_title:     '✅ Avviso creato! — Avvisi',
  success_page_heading:   '✅ Avviso creato!',
  success_page_msg:       'Riceverai un\'email a <strong>{email}</strong> quando appariranno nuovi prodotti per "<strong>{keywords}</strong>".',
  success_page_cta:       'Crea un altro avviso',

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin_disabled_title:   'Admin disabilitato',
  admin_disabled_msg:     'Imposta ADMIN_PASSWORD in .env per abilitare il pannello admin.',
  admin_auth_required:    'Autenticazione richiesta',
  admin_wrong_password:   'Password errata',

  // ── Email ─────────────────────────────────────────────────────────────────
  email_confirmation_subject:    '✅ Avviso creato: "{keywords}" su Wallapop',
  email_confirmation_title:      '✅ Avviso creato',
  email_confirmation_subtitle:   'Ti avviseremo quando appariranno nuovi prodotti',
  email_confirmation_intro:      'Il tuo avviso Wallapop è attivo:',
  email_confirmation_search:     'Ricerca',
  email_confirmation_price:      'Prezzo',
  email_confirmation_email_lbl:  'Email',
  email_confirmation_unsub:      '❌ Elimina questo avviso',

  email_verification_subject:    '✅ Conferma il tuo avviso: "{keywords}"',
  email_verification_title:      '📧 Conferma il tuo avviso',
  email_verification_subtitle:   'Un clic per attivarlo',
  email_verification_intro:      'Hai creato un avviso per <strong>"{keywords}"</strong>.<br>Clicca il pulsante per confermare la tua email e attivare l\'avviso:',
  email_verification_cta:        '✅ Conferma e attiva avviso',
  email_verification_disclaimer: 'Se non hai creato questo avviso, ignora questa email.<br>Il link scade in 48 ore.',
  email_verification_unsub:      '❌ Annulla questo avviso',

  email_alert_subject:   '🆕 {count} nuov{plural_it} su Wallapop: "{keywords}"{price_suffix}',
  email_alert_title:     '🔔 Avvisi di Seconda Mano',
  email_alert_subtitle:  '{count} nuov{plural_it} prodott{plural_it} disponibil{plural_it}',
  email_alert_view:      'Vedi →',
  email_alert_footer:    'Ricevi questa email perché hai creato un avviso su Wallapop Avvisi.',
  email_alert_unsub:     '❌ Elimina questo avviso',

  // ── Errori API ────────────────────────────────────────────────────────────
  api_email_required:    'Email e parole chiave sono obbligatorie',
  api_email_invalid:     'Indirizzo email non valido',
  api_keywords_short:    'Le parole chiave sono troppo corte',
  api_price_min_not_valid: 'Prezzo minimo non valido',
  api_price_max_not_valid: 'Prezzo massimo non valido',
  api_price_min_max:     'Il prezzo minimo non può essere maggiore del massimo',
  api_limit_reached:     'Hai raggiunto il limite di {limit} avviso{plural} attivo{plural} per questa email.',
  api_webhook_invalid:   'L\'URL del webhook deve iniziare con http:// o https://',
  api_internal_error:    'Errore interno. Riprova.',
  api_rate_limit:        'Troppe richieste. Attendi qualche minuto.',

  // ── Categorie ─────────────────────────────────────────────────────────────
  cat_tecnologia:       'Tecnologia',
  cat_moviles:          'Telefoni cellulari',
  cat_informatica:      'Informatica',
  cat_moda:             'Moda e accessori',
  cat_motor:            'Motori',
  cat_deporte:          'Sport e tempo libero',
  cat_hogar:            'Casa e giardino',
  cat_tv:               'TV e audio',
  cat_consolas:         'Console e videogiochi',
  cat_camaras:          'Fotocamere e fotografia',
  cat_coleccionismo:    'Collezionismo',
  cat_libros:           'Libri e musica',
  cat_bebes:            'Neonati e bambini',
  cat_otros:            'Altro',

  // ── Pannello Admin ────────────────────────────────────────────────────────
  admin_title:              'Admin — Wallapop Avvisi',
  admin_back_link:          '← Torna al sito',
  admin_stat_active:        'Avvisi attivi',
  admin_stat_total:         'Avvisi totali',
  admin_stat_users:         'Utenti',
  admin_stat_emails_sent:   'Email inviate',
  admin_stat_emails_failed: 'Email fallite',
  admin_stat_success_rate:  'Tasso di successo',
  admin_stat_deleted:       'Eliminati',
  admin_stat_seen:          'Prodotti visti',
  admin_stat_pending:       '⏳ In attesa di verifica',

  admin_users_title:        '📧 Utenti e limiti',
  admin_users_active_toggle:'Con avvisi attivi',
  admin_users_col_email:    'Email',
  admin_users_col_alerts:   'Avvisi attivi / totali',
  admin_users_col_sent:     'Email inviate',
  admin_users_col_limit:    'Limite',

  admin_alerts_title:       '🔔 Avvisi',
  admin_alerts_active_toggle: 'Solo attivi',
  admin_alerts_search_ph:   '🔎 Cerca per parole chiave, email...',
  admin_alerts_freq_any:    'Qualsiasi frequenza',
  admin_alerts_freq_imm:    '⚡ Immediato',
  admin_alerts_freq_daily:  '📅 Giornaliero',
  admin_alerts_freq_weekly: '📆 Settimanale',
  admin_alerts_clear:       '✕ Pulisci',
  admin_col_status:         'Stato',
  admin_col_search:         'Ricerca',
  admin_col_email:          'Email',
  admin_col_price:          'Prezzo',
  admin_col_category:       'Categoria',
  admin_col_frequency:      'Frequenza',
  admin_col_webhook:        'Webhook',
  admin_col_created:        'Creato',
  admin_col_last_run:       'Ultimo run',
  admin_col_emails:         'Email',
  admin_col_action:         'Azione',

  admin_status_active:      'Attivo',
  admin_status_inactive:    'Inattivo',
  admin_btn_deactivate:     'Disattiva',
  admin_btn_reactivate:     'Riattiva',
  admin_btn_delete:         '🗑️ Elimina',
  admin_confirm_deactivate: 'Disattivare questo avviso?',
  admin_confirm_delete:     'Eliminare questo avviso?',
  admin_confirm_hard_delete:'⚠️ ELIMINAZIONE DEFINITIVA: questo avviso e la sua cronologia verranno eliminati permanentemente dal database. Continuare?',

  admin_empty_alerts:       'Nessun avviso ancora',
  admin_empty_users:        'Nessun utente ancora',
  admin_empty_data:         'Nessun dato ancora',

  admin_badge_verified:     '✅ Verificato',
  admin_badge_pending:      '⏳ In attesa',
  admin_webhook_on:         '🔗 ON',
  admin_webhook_off:        '— OFF',
  admin_edit_label:         'modifica',
  admin_save_label:         'Salva',
  admin_confirm_delete_webhook: 'Eliminare il webhook?',
  admin_active_of:          'attivi di',
  admin_created_label:      'creati',
  admin_max_label:          'Max:',

  // ── Selettore lingua ──────────────────────────────────────────────────────
  lang_select_label: 'Lingua',
};
