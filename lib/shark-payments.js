'use strict';

const {randomUUID, createHash} = require('node:crypto');
const {ApiError, env} = require('./api-bootstrap.js');
const {priceItems} = require('./blackcat-simulation.cjs');

const hash = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const orderKey = token => 'payments:shark:order:' + hash(token);

function config() {
  const key = env('SHARKPAY_API_KEY');
  const redisUrl = env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL');
  const redisToken = env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN');
  let url;
  try { url = new URL(redisUrl); } catch {}
  if (!key) throw new ApiError(503, 'Configure SHARKPAY_API_KEY nas variáveis secretas do servidor.');
  if (url?.protocol !== 'https:' || !redisToken) throw new ApiError(503, 'Configure o Redis persistente de pedidos na Vercel.');
  return {key, redis:url.origin, redisToken};
}

async function redis(...args) {
  const settings = config();
  try {
    const response = await fetch(settings.redis, {method:'POST', redirect:'error', signal:AbortSignal.timeout(5000),
      headers:{Authorization:`Bearer ${settings.redisToken}`, 'Content-Type':'application/json'}, body:JSON.stringify(args)});
    const data = await response.json();
    if (!response.ok || data.error || !Object.hasOwn(data, 'result')) throw new Error();
    return data.result;
  } catch { throw new ApiError(503, 'O armazenamento de pedidos está indisponível.'); }
}

async function gateway(route, options = {}) {
  const {key} = config();
  try {
    const response = await fetch('https://api.sharkpaymentsbrasil.com.br/v1' + route, {
      method:options.body ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(8000),
      headers:{'x-api-key':key, 'Content-Type':'application/json', ...(options.idempotencyKey ? {'Idempotency-Key':options.idempotencyKey} : {})},
      body:options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new ApiError(response.status === 401 || response.status === 403 ? 503 : 502,
      typeof data.error === 'string' ? data.error : 'A Shark Payments não conseguiu processar a solicitação.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'Não foi possível confirmar a resposta da Shark Payments. Consulte o pedido antes de tentar outra cobrança.');
  }
}

async function load(key) {
  const raw = await redis('GET', key);
  return raw ? JSON.parse(raw) : null;
}
async function save(key, order) {
  const result = await redis('EVAL', `
    local raw = redis.call('GET', KEYS[1])
    local current = raw and cjson.decode(raw) or {}
    local incoming = cjson.decode(ARGV[1])
    for k,v in pairs(incoming) do current[k] = v end
    local encoded = cjson.encode(current)
    redis.call('SET', KEYS[1], encoded)
    return encoded
  `, 1, key, JSON.stringify(order));
  return JSON.parse(result);
}

function info() {
  const business = {
    publicName:env('BUSINESS_PUBLIC_NAME', 'Loja Online'),
    legalName:env('BUSINESS_LEGAL_NAME'),
    taxId:env('BUSINESS_CNPJ'),
    address:env('BUSINESS_ADDRESS'),
    contactEmail:env('BUSINESS_CONTACT_EMAIL'),
    privacyUrl:env('BUSINESS_PRIVACY_URL'),
    termsUrl:env('BUSINESS_TERMS_URL'),
  };
  return {...business, simulation:false, environment:'live', provider:'shark-payments', fulfillmentStatus:'awaiting_registration'};
}
function publicOrder(order, token) {
  return {...info(), orderId:order.id, orderToken:token, amount:order.amount, status:order.status,
    operator:env('BUSINESS_PUBLIC_NAME', 'Loja Online'), fulfillmentStatus:'awaiting_registration',
    qrCode:order.qrCode || '', qrCodeImage:order.qrCodeImage || '', expiresAt:order.expiresAt || null};
}
function normalizeCharge(data, order) {
  if (!data || data.object !== 'charge' || data.id !== order.gatewayId || data.amount !== order.amount
    || data.external_reference !== order.id || data.method !== 'pix'
    || !['pending','paid','expired','failed','refunded','chargeback'].includes(data.status)) {
    throw new ApiError(502, 'A cobrança retornada pela Shark Payments não corresponde ao pedido.');
  }
  const pix = data.pix || {};
  const rawImage = typeof pix.qr_code_image === 'string' ? pix.qr_code_image : '';
  const image = /^https:\/\//.test(rawImage) || /^data:image\//.test(rawImage) ? rawImage
    : /^[A-Za-z0-9+/]+={0,2}$/.test(rawImage) ? 'data:image/png;base64,' + rawImage : '';
  return {...order, status:data.status === 'paid' ? 'approved' : ['refunded','chargeback'].includes(data.status) ? 'refunded' : ['expired','failed'].includes(data.status) ? 'cancelled' : 'pending',
    qrCode:typeof pix.copy_paste === 'string' ? pix.copy_paste : order.qrCode,
    qrCodeImage:image, expiresAt:pix.expires_at || order.expiresAt,
    updated_at:new Date().toISOString()};
}

async function createPayment(input) {
  config();
  info();
  if (input.consent !== true) throw new ApiError(422, 'Aceite os termos e a política de privacidade.');
  if (!validToken(input.requestId)) throw new ApiError(422, 'Identificador de pedido inválido.');
  if (!input.buyer || typeof input.buyer.name !== 'string' || input.buyer.name.trim().length < 3
    || input.buyer.name.trim().length > 100 || typeof input.buyer.email !== 'string'
    || input.buyer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.buyer.email)) throw new ApiError(422, 'Informe nome e e-mail válidos.');
  let priced;
  try { priced = priceItems(input.items); } catch (error) { throw new ApiError(422, error.message); }
  const key = orderKey(input.requestId);
  const fingerprint = hash(JSON.stringify({items:input.items, buyer:{name:input.buyer.name.trim(), email:input.buyer.email.trim()}}));
  let order = await load(key);
  if (order) {
    if (order.fingerprint !== fingerprint) throw new ApiError(409, 'O pedido já existe com outros dados. Confira o pagamento anterior antes de iniciar outro pedido.');
    if (order.gatewayId) return publicOrder(order, input.requestId);
    if (order.status === 'creating') throw new ApiError(409, 'Pedido em processamento. Consulte novamente em alguns segundos.');
  }
  if (!order) {
    order = {id:randomUUID(), fingerprint, amount:priced.amount, status:'creating', created_at:new Date().toISOString()};
    if (await redis('SET', key, JSON.stringify(order), 'NX') !== 'OK') throw new ApiError(409, 'Pedido em processamento. Consulte novamente em alguns segundos.');
    await redis('ZADD', 'payments:shark:orders', Date.now(), key);
  }
  try {
    const charge = await gateway('/charges', {idempotencyKey:input.requestId, body:{amount:priced.amount, method:'pix',
      description:'Loja Online', external_reference:order.id,
      customer:{name:input.buyer.name.trim(), email:input.buyer.email.trim()}}});
    if (charge?.object !== 'charge' || typeof charge.id !== 'string' || charge.amount !== priced.amount
      || charge.external_reference !== order.id || charge.method !== 'pix') throw new ApiError(502, 'A Shark Payments retornou uma cobrança inconsistente.');
    order = normalizeCharge(charge, {...order, gatewayId:charge.id});
    await save(key, order);
    return publicOrder(order, input.requestId);
  } catch (error) {
    if (error.status === 502) {
      order.status = 'pending_review';
      await save(key, order);
    }
    throw error;
  }
}

async function paymentStatus(token) {
  config();
  if (!validToken(token)) throw new ApiError(404, 'Pedido não encontrado.');
  const key = orderKey(token);
  let order = await load(key);
  if (!order) throw new ApiError(404, 'Pedido não encontrado.');
  if (order.gatewayId && ['pending','approved','cancelled','refunded'].includes(order.status)) {
    const charge = await gateway('/charges/' + encodeURIComponent(order.gatewayId));
    order = await save(key, normalizeCharge(charge, order));
  }
  return publicOrder(order, token);
}

module.exports = {config, info, createPayment, paymentStatus};
