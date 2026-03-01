/** English translations */
module.exports = {
  lang: 'en',
  dir: 'ltr',

  // ── Main page ─────────────────────────────────────────────────────────────
  page_title:        'Second-hand Alerts — Get notified about new listings',
  page_description:  'Create free alerts and receive an email when new second-hand products matching your criteria appear.',
  header_title:      '🔔 Second-Hand Alerts',
  header_subtitle:   'Get an email when new <b>available</b> products matching your search appear',

  feature_email:    '📧 Instant email',
  feature_no_reg:   '✨ No registration',
  feature_cancel:   '🗑️ Cancel anytime',

  form_title:       '📬 Create alert',

  label_keywords:   'What are you looking for?',
  hint_required:    '(required)',
  placeholder_keywords: 'e.g.: iphone 13, ps5, bicycle...',

  label_email:      'Your email',
  placeholder_email: 'youremail@example.com',

  label_min_price:  'Minimum price',
  hint_currency:    '(€)',
  label_max_price:  'Maximum price',
  placeholder_max_price: 'no limit',

  label_category:   'Category',
  hint_optional:    '(optional)',
  option_all_categories: '— All categories —',

  label_frequency:  'Email frequency',
  option_immediate: '⚡ Immediate — as soon as something appears',
  option_daily:     '📅 Daily digest — once a day',
  option_weekly:    '📆 Weekly digest — once a week',

  label_shipping:   '🚚 Only products <strong>with shipping</strong>',

  webhook_label:    '🔗 Webhook / Integration',
  webhook_subtitle: '(Zapier, n8n, Slack…)',
  webhook_url_label:'Webhook URL',
  webhook_url_hint: '(optional)',
  webhook_placeholder: 'https://hooks.zapier.com/hooks/catch/…',
  webhook_description: 'When new products are found, we will send a <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:11px;">POST</code> to this URL with the items JSON. Compatible with <strong>Zapier</strong>, <strong>n8n</strong>, <strong>Make</strong>, <strong>Slack</strong> and any service that accepts HTTP webhooks.',

  btn_submit:       '🔔 Create free alert',
  btn_creating:     '⏳ Creating alert...',
  note_no_spam:     'No registration · No spam · Cancel with one click from any email',

  success_title:    'Alert created!',
  success_msg:      'We\'ll notify <strong>{email}</strong> when new products appear for "<strong>{keywords}</strong>".<br><br>Check your inbox — we\'ve sent you a confirmation email.',
  back_link:        '← Create another alert',

  error_keywords_short: 'Please tell us what you are looking for',
  error_email_invalid:  'Please enter a valid email address',
  error_price_range:    'The minimum price cannot be greater than the maximum',
  error_generic:        'Error creating the alert. Please try again.',
  error_connection:     'Connection error. Please try again.',

  // ── How it works ─────────────────────────────────────────────────────────
  how_step1_title: '1. Create your alert',
  how_step1_desc:  'Enter your keywords, price and category',
  how_step2_title: '2. The agent searches',
  how_step2_desc:  'Monitors listings every few minutes',
  how_step3_title: '3. Receive the email',
  how_step3_desc:  'We notify you instantly, no spam',

  footer_text: 'Made with ❤️ · <a href="https://github.com/enrimr/used-items-alert-agent" target="_blank">GitHub</a> · MIT License',

  // ── Simple pages ──────────────────────────────────────────────────────────
  verify_invalid_title:   '❌ Invalid link',
  verify_invalid_msg:     'This verification link does not exist or has already been used.',
  verify_success_title:   '✅ Email verified!',
  verify_success_msg:     'Your alert for "<strong>{keywords}</strong>" is now active.<br><br>We\'ll notify <strong>{email}</strong> when new products appear.',
  verify_cta:             'Create another alert',

  unsub_not_found_title:  '❌ Alert not found',
  unsub_not_found_msg:    'This alert does not exist or has already been deleted.',
  unsub_success_title:    '✅ Alert deleted',
  unsub_success_msg:      'Your alert for "<strong>{keywords}</strong>" has been successfully deleted.<br><br>You will no longer receive emails about this search.',
  unsub_error_title:      'Error',
  unsub_error_msg:        'Could not delete the alert. Please try again.',

  // ── /success page ─────────────────────────────────────────────────────────
  success_page_title:     '✅ Alert created! — Alerts',
  success_page_heading:   '✅ Alert created!',
  success_page_msg:       'You will receive an email at <strong>{email}</strong> when new products appear for "<strong>{keywords}</strong>".',
  success_page_cta:       'Create another alert',

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin_disabled_title:   'Admin disabled',
  admin_disabled_msg:     'Set ADMIN_PASSWORD in .env to enable the admin panel.',
  admin_auth_required:    'Authentication required',
  admin_wrong_password:   'Wrong password',

  // ── Emails ────────────────────────────────────────────────────────────────
  email_confirmation_subject:    '✅ Alert created: "{keywords}" on Wallapop',
  email_confirmation_title:      '✅ Alert created',
  email_confirmation_subtitle:   'We\'ll notify you when new products appear',
  email_confirmation_intro:      'Your Wallapop alert is active:',
  email_confirmation_search:     'Search',
  email_confirmation_price:      'Price',
  email_confirmation_email_lbl:  'Email',
  email_confirmation_unsub:      '❌ Delete this alert',

  email_verification_subject:    '✅ Confirm your alert: "{keywords}"',
  email_verification_title:      '📧 Confirm your alert',
  email_verification_subtitle:   'One click to activate it',
  email_verification_intro:      'You created an alert for <strong>"{keywords}"</strong>.<br>Click the button to confirm your email and activate the alert:',
  email_verification_cta:        '✅ Confirm and activate alert',
  email_verification_disclaimer: 'If you did not create this alert, ignore this email.<br>The link expires in 48 hours.',
  email_verification_unsub:      '❌ Cancel this alert',

  email_alert_subject:   '🆕 {count} new item{plural} on Wallapop: "{keywords}"{price_suffix}',
  email_alert_title:     '🔔 Second-Hand Alerts',
  email_alert_subtitle:  '{count} new available product{plural}',
  email_alert_view:      'View →',
  email_alert_footer:    'You receive this email because you created an alert on Wallapop Alerts.',
  email_alert_unsub:     '❌ Delete this alert',

  // ── API errors ────────────────────────────────────────────────────────────
  api_email_required:    'Email and keywords are required',
  api_email_invalid:     'Invalid email address',
  api_keywords_short:    'Keywords are too short',
  api_price_min_not_valid: 'Invalid minimum price',
  api_price_max_not_valid: 'Invalid maximum price',
  api_price_min_max:     'Minimum price cannot be greater than maximum',
  api_limit_reached:     'You have reached the limit of {limit} active alert{plural} for this email.',
  api_webhook_invalid:   'Webhook URL must start with http:// or https://',
  api_internal_error:    'Internal error. Please try again.',
  api_rate_limit:        'Too many requests. Please wait a few minutes.',

  // ── Categories ────────────────────────────────────────────────────────────
  cat_tecnologia:       'Technology',
  cat_moviles:          'Mobile phones',
  cat_informatica:      'Computers',
  cat_moda:             'Fashion & accessories',
  cat_motor:            'Motors',
  cat_deporte:          'Sports & leisure',
  cat_hogar:            'Home & garden',
  cat_tv:               'TV & audio',
  cat_consolas:         'Consoles & video games',
  cat_camaras:          'Cameras & photography',
  cat_coleccionismo:    'Collectibles',
  cat_libros:           'Books & music',
  cat_bebes:            'Babies & children',
  cat_otros:            'Other',

  // ── Admin panel ───────────────────────────────────────────────────────────
  admin_title:              'Admin — Wallapop Alerts',
  admin_back_link:          '← Back to website',
  admin_stat_active:        'Active alerts',
  admin_stat_total:         'Total alerts',
  admin_stat_users:         'Users',
  admin_stat_emails_sent:   'Emails sent',
  admin_stat_emails_failed: 'Failed emails',
  admin_stat_success_rate:  'Success rate',
  admin_stat_deleted:       'Deleted',
  admin_stat_seen:          'Products seen',
  admin_stat_pending:       '⏳ Pending verification',

  admin_users_title:        '📧 Users & limits',
  admin_users_active_toggle:'With active alerts',
  admin_users_col_email:    'Email',
  admin_users_col_alerts:   'Active / total alerts',
  admin_users_col_sent:     'Emails sent',
  admin_users_col_limit:    'Limit',

  admin_alerts_title:       '🔔 Alerts',
  admin_alerts_active_toggle: 'Active only',
  admin_alerts_search_ph:   '🔎 Search by keywords, email...',
  admin_alerts_freq_any:    'Any frequency',
  admin_alerts_freq_imm:    '⚡ Immediate',
  admin_alerts_freq_daily:  '📅 Daily',
  admin_alerts_freq_weekly: '📆 Weekly',
  admin_alerts_clear:       '✕ Clear',
  admin_col_status:         'Status',
  admin_col_search:         'Search',
  admin_col_email:          'Email',
  admin_col_price:          'Price',
  admin_col_category:       'Category',
  admin_col_frequency:      'Frequency',
  admin_col_webhook:        'Webhook',
  admin_col_created:        'Created',
  admin_col_last_run:       'Last run',
  admin_col_emails:         'Emails',
  admin_col_action:         'Action',

  admin_status_active:      'Active',
  admin_status_inactive:    'Inactive',
  admin_btn_deactivate:     'Deactivate',
  admin_btn_reactivate:     'Reactivate',
  admin_btn_delete:         '🗑️ Delete',
  admin_confirm_deactivate: 'Deactivate this alert?',
  admin_confirm_delete:     'Delete this alert?',
  admin_confirm_hard_delete:'⚠️ PERMANENT DELETE: this alert and its history will be permanently removed from the database. Continue?',

  admin_empty_alerts:       'No alerts yet',
  admin_empty_users:        'No users yet',
  admin_empty_data:         'No data yet',

  admin_badge_verified:     '✅ Verified',
  admin_badge_pending:      '⏳ Pending',
  admin_webhook_on:         '🔗 ON',
  admin_webhook_off:        '— OFF',
  admin_edit_label:         'edit',
  admin_save_label:         'Save',
  admin_confirm_delete_webhook: 'Delete webhook?',
  admin_active_of:          'active of',
  admin_created_label:      'created',
  admin_max_label:          'Max:',

  // ── Language selector ─────────────────────────────────────────────────────
  lang_select_label: 'Language',
};
