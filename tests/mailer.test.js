/**
 * Tests unitarios para src/mailer.js
 *
 * Prueba los builders de HTML/texto (funciones puras) y la lógica
 * de selección de transporte, sin hacer peticiones reales de red.
 *
 * Las funciones buildAlertHtml, buildAlertText, etc. son internas, así que
 * las probamos indirectamente a través de sendAlertEmail mockeando el
 * transporte (send) para capturar los parámetros que recibe.
 */

// Guardar entorno
const originalEnv = { ...process.env };

// Mock de dotenv para que no cargue el .env real
jest.mock('dotenv', () => ({ config: jest.fn() }));

// Mock de nodemailer para el transporte SMTP
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test' });
const mockVerify   = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify:   mockVerify,
  })),
}));

// Mock de https para el transporte Resend
const mockResendRequest = jest.fn();
jest.mock('https', () => ({
  request: mockResendRequest,
}));

const SMTP_VARS = [
  'RESEND_API_KEY', 'RESEND_EMAIL_FROM',
  'EMAIL_FROM', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT',
  'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASS', 'EMAIL_SMTP_SECURE', 'EMAIL_TO',
  'BASE_URL', 'THEME_COLOR',
];

beforeEach(() => {
  jest.resetModules();
  SMTP_VARS.forEach(k => delete process.env[k]);
  mockSendMail.mockClear();
  mockVerify.mockClear();
});

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

// ── verifyEmailConfig ──────────────────────────────────────────────────────

describe('verifyEmailConfig', () => {
  test('devuelve ok:true con transport:resend cuando hay RESEND_API_KEY', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const { verifyEmailConfig } = require('../src/mailer');
    const result = await verifyEmailConfig();
    expect(result.ok).toBe(true);
    expect(result.transport).toBe('resend');
  });

  test('devuelve ok:false si SMTP está incompleto', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.gmail.com'; // sin user/pass
    const { verifyEmailConfig } = require('../src/mailer');
    const result = await verifyEmailConfig();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/incompleta/i);
  });

  test('verifica SMTP cuando está configurado correctamente', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_USER = 'user@test.com';
    process.env.EMAIL_SMTP_PASS = 'pass123';
    const { verifyEmailConfig } = require('../src/mailer');
    const result = await verifyEmailConfig();
    expect(result.ok).toBe(true);
    expect(mockVerify).toHaveBeenCalled();
  });

  test('devuelve ok:false si verify() falla', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_USER = 'user@test.com';
    process.env.EMAIL_SMTP_PASS = 'pass123';
    mockVerify.mockRejectedValueOnce(new Error('Connection refused'));
    const { verifyEmailConfig } = require('../src/mailer');
    const result = await verifyEmailConfig();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Connection refused');
  });
});

// ── sendAlertEmail — sin transporte configurado ───────────────────────────

describe('sendAlertEmail — sin transporte', () => {
  test('devuelve false si no hay remitente configurado', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    const items = [{ id: '1', title: 'Test', price: 10, currency: 'EUR', location: 'Madrid', url: 'http://x.com', images: [] }];
    const config = { keywords: 'ps5', minPrice: null, maxPrice: null, categoryId: '', categoryName: 'Todas' };
    const result = await sendAlertEmail(items, config, 'to@test.com', null);
    expect(result).toBe(false);
  });

  test('devuelve false si items está vacío', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_USER = 'u';
    process.env.EMAIL_SMTP_PASS = 'p';
    process.env.EMAIL_FROM = 'from@test.com';
    const { sendAlertEmail } = require('../src/mailer');
    const config = { keywords: 'ps5', minPrice: null, maxPrice: null, categoryId: '', categoryName: 'Todas' };
    const result = await sendAlertEmail([], config, 'to@test.com', null);
    expect(result).toBe(false);
  });
});

// ── sendAlertEmail — via SMTP ──────────────────────────────────────────────

describe('sendAlertEmail — via SMTP', () => {
  const items = [
    {
      id: 'item-1', title: 'PS5 Segunda mano', price: 350,
      currency: 'EUR', location: 'Madrid',
      url: 'https://es.wallapop.com/item/ps5-123',
      images: ['https://img.example.com/ps5.jpg'],
      description: 'PS5 en perfecto estado con dos mandos',
    },
  ];
  const config = { keywords: 'ps5', minPrice: 200, maxPrice: 400, categoryId: '12461', categoryName: 'Consolas' };

  beforeEach(() => {
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_USER = 'sender@test.com';
    process.env.EMAIL_SMTP_PASS = 'pass123';
    process.env.EMAIL_FROM      = 'sender@test.com';
    process.env.BASE_URL        = 'http://localhost:3000';
    process.env.THEME_COLOR     = 'teal';
  });

  test('llama a sendMail con los parámetros correctos', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    const result = await sendAlertEmail(items, config, 'dest@test.com', null);
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('dest@test.com');
    expect(call.subject).toContain('ps5');
    expect(call.html).toContain('PS5 Segunda mano');
    expect(call.html).toContain('350.00');
    expect(call.html).toContain('Madrid');
  });

  test('el HTML incluye link de cancelación cuando hay subscriptionId', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    await sendAlertEmail(items, config, 'dest@test.com', 'sub-uuid-123');
    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('/unsubscribe/sub-uuid-123');
    expect(html).toContain('Eliminar esta alerta');
  });

  test('el HTML NO incluye link de cancelación en modo CLI (subscriptionId=null)', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    await sendAlertEmail(items, config, 'dest@test.com', null);
    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).not.toContain('/unsubscribe/');
    expect(html).toContain('Wallapop'); // pero sí tiene contenido
  });

  test('el texto plano contiene título, precio y URL', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    await sendAlertEmail(items, config, 'dest@test.com', null);
    const text = mockSendMail.mock.calls[0][0].text;
    expect(text).toContain('PS5 Segunda mano');
    expect(text).toContain('350.00');
    expect(text).toContain('https://es.wallapop.com/item/ps5-123');
  });

  test('el nombre del remitente es "Wallapop Alertas" con subscriptionId', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    await sendAlertEmail(items, config, 'dest@test.com', 'sub-123');
    const from = mockSendMail.mock.calls[0][0].from;
    expect(from).toContain('Wallapop Alertas');
  });

  test('el nombre del remitente es "Wallapop Agent" en modo CLI', async () => {
    const { sendAlertEmail } = require('../src/mailer');
    await sendAlertEmail(items, config, 'dest@test.com', null);
    const from = mockSendMail.mock.calls[0][0].from;
    expect(from).toContain('Wallapop Agent');
  });

  test('devuelve false y no lanza si sendMail falla', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    // Silenciar el console.error esperado de src/mailer.js
    const spy = jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    const { sendAlertEmail } = require('../src/mailer');
    const result = await sendAlertEmail(items, config, 'dest@test.com', null);
    expect(result).toBe(false);
    spy.mockRestore();
  });
});

// ── sendConfirmationEmail ──────────────────────────────────────────────────

describe('sendConfirmationEmail', () => {
  beforeEach(() => {
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_USER = 'sender@test.com';
    process.env.EMAIL_SMTP_PASS = 'pass123';
    process.env.EMAIL_FROM      = 'sender@test.com';
    process.env.BASE_URL        = 'http://localhost:3000';
    process.env.THEME_COLOR     = 'orange';
  });

  test('envía email de confirmación con los datos de la suscripción', async () => {
    const { sendConfirmationEmail } = require('../src/mailer');
    const sub = { id: 'sub-abc', keywords: 'nintendo', min_price: 50, max_price: 150 };
    const result = await sendConfirmationEmail('user@test.com', sub);
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@test.com');
    expect(call.subject).toContain('nintendo');
    expect(call.html).toContain('sub-abc'); // unsubscribe URL
    expect(call.html).toContain('50€');
  });

  test('devuelve false si no hay remitente', async () => {
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_SMTP_USER;
    const { sendConfirmationEmail } = require('../src/mailer');
    const result = await sendConfirmationEmail('u@test.com', { id: 'x', keywords: 'test' });
    expect(result).toBe(false);
  });
});
