/**
 * Cloudflare Pages Functions - Backend Worker (Enhanced)
 * 
 * 功能:
 * 1. 自动抓取节点并存储到 KV
 * 2. 提供订阅接口 (Base64编码)
 * 3. Telegram Bot 管理 (带键盘菜单)
 */

// ==========================================
// 1. 配置区域
// ==========================================

// 自定义菜单键盘布局
const BOT_KEYBOARD = {
    keyboard: [
        [{ text: "🔄 立即更新" }, { text: "📊 系统状态" }],
        [{ text: "🔗 订阅链接" }, { text: "⚙️ 检测配置" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "请选择操作..."
};

// 预置订阅源
const PRESET_URLS = [
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/singbox/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/singbox/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ip/singbox/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ip/singbox/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria/4/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria2/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria2/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria2/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria2/4/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/xray/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/xray/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/xray/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/xray/4/config.json"
];

const SUB_NAME = "SubLink";

// ==========================================
// 2. 主逻辑
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathPart = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();

    // 静态资源放行
    const isApi = pathPart.startsWith('api/');
    const isSub = ['all', 'vless', 'vmess', 'trojan', 'hysteria', 'hysteria2', 'clash', 'sub', 'subscribe'].some(t => pathPart.includes(t));
    
    if (!isApi && !isSub && pathPart !== 'webhook') {
        return env.ASSETS.fetch(request);
    }

    // --- 接口: Webhook 设置 ---
    if (pathPart === 'webhook') {
      if (!env.TG_TOKEN) return new Response('❌ Error: TG_TOKEN not set in Pages Settings.', { status: 500 });
      const webhookUrl = `${url.origin}/api/telegram`;
      const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/setWebhook?url=${webhookUrl}`);
      const j = await r.json();
      return new Response(`Webhook set to: ${webhookUrl}\nTelegram API Response: ${JSON.stringify(j, null, 2)}`);
    }

    // --- 接口: Telegram Bot 入口 ---
    if (pathPart === 'api/telegram' && request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
             const chatId = String(update.message.from.id);
             if (env.ADMIN_ID && chatId !== String(env.ADMIN_ID)) {
                 return new Response('Unauthorized');
             }
             ctx.waitUntil(handleTelegramCommand(update.message, env, url.origin));
        }
      } catch(e) { console.error("Bot Error:", e); }
      return new Response('OK');
    }

    // --- 接口: 前端状态查询 ---
    if (pathPart === 'api/status') {
         let count = 0;
         let updateTime = null;
         try {
             if (!env.KV) throw new Error("KV_NOT_BOUND");
             const stored = await env.KV.get('NODES');
             if (stored) {
                 const nodes = JSON.parse(stored);
                 count = nodes.length;
             }
             updateTime = await env.KV.get('LAST_UPDATE');
         } catch(e) {
             console.error("KV Error:", e);
         }
         
         return new Response(JSON.stringify({ 
             count, 
             last_update: updateTime || '等待更新...',
             bot_ready: !!env.TG_TOKEN,
             kv_ready: !!env.KV
         }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- 接口: 订阅输出 ---
    const queryType = url.searchParams.get('type');
    let targetType = queryType ? queryType.toLowerCase() : '';
    
    const knownTypes = ['vless', 'vmess', 'hysteria', 'hysteria2', 'trojan', 'ss', 'clash', 'all'];
    if (!targetType) {
        for(const t of knownTypes) {
            if(pathPart.includes(t)) targetType = t;
        }
    }
    if (!targetType) targetType = 'all';

    let nodesData = [];
    try {
        if (env.KV) {
            const stored = await env.KV.get('NODES');
            if (stored) nodesData = JSON.parse(stored);
        }
    } catch(e) {}

    let filteredNodes = nodesData;
    if (targetType && targetType !== 'all') {
      const types = targetType.split(',').map(t => t.trim());
      filteredNodes = nodesData.filter(node => types.some(t => node.p.includes(t)));
    }

    // UTF-8 安全的 Base64 编码
    const links = filteredNodes.map(n => n.l).join('\n');
    const encoded = safeBtoa(links);

    return new Response(encoded, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${SUB_NAME}_${targetType}.txt"`,
        "Profile-Update-Interval": "24",
        "Subscription-Userinfo": "upload=0; download=0; total=1073741824000000; expire=0",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  }
};

// ==========================================
// 3. Telegram Bot 逻辑处理
// ==========================================
async function handleTelegramCommand(message, env, origin) {
    const chatId = message.chat.id;
    const text = message.text.trim();
    
    const send = async (msg, options = {}) => {
        const payload = {
            chat_id: chatId, 
            text: msg, 
            parse_mode: options.parseMode || 'HTML', 
            disable_web_page_preview: true,
            reply_markup: options.removeKeyboard ? { remove_keyboard: true } : BOT_KEYBOARD
        };
        await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
    };
    
    const sendPhoto = async (photoUrl, caption) => {
        await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendPhoto`, {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ 
                 chat_id: chatId, 
                 photo: photoUrl, 
                 caption: caption,
                 reply_markup: BOT_KEYBOARD 
             })
        });
    }

    // 1. 帮助 / 启动
    if (text === '/start' || text.includes('帮助')) {
        await send(
            `👋 <b>欢迎使用 SubLink 管理机器人</b>\n\n` +
            `🔄 <b>立即更新</b>: 抓取最新节点\n` +
            `📊 <b>系统状态</b>: 查看节点数量\n` +
            `🔗 <b>订阅链接</b>: 获取订阅地址\n`
        );
    } 
    // 2. 更新节点
    else if (text === '/update' || text.includes('立即更新')) {
        if (!env.KV) {
            await send(`❌ <b>错误</b>: 未绑定 KV Namespace。`);
            return;
        }

        await send("⏳ <b>正在抓取...</b>\n正在从订阅源聚合节点，这可能需要 10-20 秒。");
        const startTime = Date.now();
        
        try {
            const nodes = await fetchAndParseAll(PRESET_URLS);
            
            if (nodes.length === 0) {
                 await send(`⚠️ <b>警告</b>: 抓取完成，但没有找到有效节点。`);
                 return;
            }

            await env.KV.put('NODES', JSON.stringify(nodes));
            
            const now = new Date();
            const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
            await env.KV.put('LAST_UPDATE', beijingTime);
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            await send(`✅ <b>更新成功!</b>\n\n📊 节点总数: <b>${nodes.length}</b>\n⏱️ 耗时: ${duration}秒\n📅 时间: ${beijingTime}`);
        } catch (e) {
            await send(`❌ <b>更新失败</b>:\n<pre>${e.message}</pre>`);
        }
    } 
    // 3. 查看状态
    else if (text === '/status' || text.includes('系统状态')) {
        let count = 0;
        let lastUp = "从未更新";
        let kvStatus = "✅ 正常";
        try {
            if (!env.KV) throw new Error("KV 未绑定");
            const stored = await env.KV.get('NODES');
            if (stored) count = JSON.parse(stored).length;
            lastUp = await env.KV.get('LAST_UPDATE') || "未知";
        } catch(e) { kvStatus = `❌ 异常`; }
        await send(`📊 <b>系统状态</b>\n\n🔢 节点: ${count}\n🕒 更新: ${lastUp}\n💾 KV: ${kvStatus}`);
    } 
    // 4. 获取订阅
    else if (text === '/sub' || text.includes('订阅链接')) {
        const subUrl = `${origin}`;
        let msg = `🔗 <b>订阅链接</b>\n\n`;
        msg += `🌐 <b>通用订阅:</b> <code>${subUrl}/all</code>\n`;
        msg += `⚡ <b>Hysteria2:</b> <code>${subUrl}/hysteria2</code>\n`;
        msg += `🚀 <b>VLESS:</b> <code>${subUrl}/vless</code>`;
        await send(msg);
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(subUrl + '/all')}`;
        await sendPhoto(qrApi, '📱 扫码直接导入');
    }
    else if (text.includes('检测配置')) {
         let report = `⚙️ <b>配置检测</b>\n\n1️⃣ KV: ${env.KV ? '✅' : '❌'}\n2️⃣ TG_TOKEN: ${env.TG_TOKEN ? '✅' : '❌'}`;
         await send(report);
    }
}

// ==========================================
// 4. 节点抓取核心逻辑 (增强版)
// ==========================================
async function fetchAndParseAll(urls) {
    const nodes = [];
    const BATCH_SIZE = 5; 
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            try {
                // 使用 Chrome User-Agent 避免被拦截
                const res = await fetch(u, { 
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    cf: { cacheTtl: 60 }
                });
                if (!res.ok) return;
                let text = await res.text();
                text = text.trim();

                // 1. 尝试解析 Sing-box JSON (因为 PRESET_URLS 包含大量 config.json)
                if (text.startsWith('{') || text.startsWith('[')) {
                    try {
                        const json = JSON.parse(text);
                        const outbounds = Array.isArray(json) ? json : (json.outbounds || []);
                        const extracted = parseSingboxOutbounds(outbounds);
                        if (extracted.length > 0) {
                            nodes.push(...extracted);
                            return; // 成功解析 JSON 后跳过后续步骤
                        }
                    } catch(e) {}
                }

                // 2. 尝试 Base64 解码 (处理编码的订阅)
                let decodedText = text;
                try {
                    // 如果不包含空格且很长，可能是 Base64
                    if (!text.includes(' ') && text.length > 20) {
                        decodedText = safeAtob(text);
                    }
                } catch(e) {}

                // 3. 正则提取链接
                const regex = /(vmess|vless|trojan|ss|hysteria2|tuic):\/\/[^\s"',;<>]+/g;
                const matches = decodedText.match(regex);
                
                if (matches) {
                    matches.forEach(link => {
                         let cleanLink = link.split('"')[0].split("'")[0].split("<")[0];
                         let p = cleanLink.split('://')[0];
                         let n = 'Node';
                         try { 
                             const hashPart = cleanLink.split('#')[1];
                             if(hashPart) n = decodeURIComponent(hashPart); 
                         } catch(e){}
                         nodes.push({ l: cleanLink, p: p, n: n });
                    });
                }
            } catch(e) {}
        });
        await Promise.all(promises);
    }
    
    // 去重
    const unique = [];
    const seen = new Set();
    for (const n of nodes) {
        if (!seen.has(n.l)) {
            seen.add(n.l);
            unique.push(n);
        }
    }
    return unique;
}

// 辅助: 解析 Sing-box 格式节点为通用链接
function parseSingboxOutbounds(outbounds) {
    const res = [];
    if (!Array.isArray(outbounds)) return res;
    
    outbounds.forEach(ob => {
        // 过滤 selector, urltest, direct 等非节点类型
        if (!ob.server || !ob.server_port || !ob.type) return;
        
        const tag = ob.tag || `Node-${Math.floor(Math.random()*1000)}`;
        
        try {
            // --- VMess ---
            if (ob.type === 'vmess') {
                const vmessBody = {
                    v: "2",
                    ps: tag,
                    add: ob.server,
                    port: ob.server_port,
                    id: ob.uuid,
                    aid: ob.alter_id || 0,
                    scy: ob.security || "auto",
                    net: ob.transport?.type || "tcp",
                    type: "none",
                    host: ob.tls?.server_name || ob.transport?.headers?.Host || "",
                    path: ob.transport?.path || "",
                    tls: ob.tls?.enabled ? "tls" : "",
                    sni: ob.tls?.server_name || "",
                    alpn: ob.tls?.alpn ? ob.tls.alpn.join(',') : ""
                };
                
                // 针对不同传输协议的特殊处理
                if (ob.transport?.type === 'grpc') {
                    vmessBody.net = "grpc";
                    vmessBody.path = ob.transport?.service_name || "";
                } else if (ob.transport?.type === 'ws') {
                    vmessBody.net = "ws";
                    vmessBody.path = ob.transport?.path || "/";
                } else if (ob.transport?.type === 'http') {
                    vmessBody.net = "tcp";
                    vmessBody.type = "http";
                }

                const link = `vmess://${safeBtoa(JSON.stringify(vmessBody))}`;
                res.push({ l: link, p: 'vmess', n: tag });
            }
            
            // --- Shadowsocks ---
            else if (ob.type === 'shadowsocks') {
                const userInfo = `${ob.method}:${ob.password}`;
                const link = `ss://${safeBtoa(userInfo)}@${ob.server}:${ob.server_port}#${encodeURIComponent(tag)}`;
                res.push({ l: link, p: 'ss', n: tag });
            }
            
            // --- Hysteria2 ---
            else if (ob.type === 'hysteria2') {
                const params = new URLSearchParams();
                if (ob.tls?.server_name) params.set('sni', ob.tls.server_name);
                if (ob.tls?.insecure) params.set('insecure', '1');
                if (ob.up_mbps) params.set('up', ob.up_mbps);
                if (ob.down_mbps) params.set('down', ob.down_mbps);
                
                const auth = ob.password || ob.auth || '';
                const link = `hysteria2://${auth}@${ob.server}:${ob.server_port}?${params.toString()}#${encodeURIComponent(tag)}`;
                res.push({ l: link, p: 'hysteria2', n: tag });
            }
            
            // --- VLESS ---
            else if (ob.type === 'vless') {
                const params = new URLSearchParams();
                params.set('encryption', 'none');
                
                const net = ob.transport?.type || 'tcp';
                if (net !== 'tcp') params.set('type', net);
                
                if (ob.tls?.enabled) {
                    params.set('security', 'tls');
                    if (ob.tls.server_name) params.set('sni', ob.tls.server_name);
                    if (ob.tls.insecure) params.set('allowInsecure', '1');
                }
                
                if (ob.transport?.path) params.set('path', ob.transport.path);
                if (ob.transport?.headers?.Host) params.set('host', ob.transport.headers.Host);
                if (ob.transport?.service_name) params.set('serviceName', ob.transport.service_name); // gRPC
                
                const uuid = ob.uuid || '';
                const link = `vless://${uuid}@${ob.server}:${ob.server_port}?${params.toString()}#${encodeURIComponent(tag)}`;
                res.push({ l: link, p: 'vless', n: tag });
            }
            
            // --- Trojan ---
            else if (ob.type === 'trojan') {
                 const params = new URLSearchParams();
                 if (ob.tls?.server_name) params.set('sni', ob.tls.server_name);
                 if (ob.tls?.insecure) params.set('allowInsecure', '1');
                 
                 const password = ob.password || '';
                 const link = `trojan://${password}@${ob.server}:${ob.server_port}?${params.toString()}#${encodeURIComponent(tag)}`;
                 res.push({ l: link, p: 'trojan', n: tag });
            }
        } catch(e) {}
    });
    return res;
}

// 辅助: UTF-8 Safe Base64 Helpers
function safeBtoa(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function safeAtob(str) {
    try {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch(e) {
        return atob(str); // Fallback to standard atob
    }
}
