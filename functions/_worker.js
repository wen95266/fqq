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

// 预置订阅源 (支持 Sing-box, Clash, Hysteria2 等格式)
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
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/clash.meta2/2/config.yaml",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/clash.meta2/2/config.yaml",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/clash.meta2/3/config.yaml",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/clash.meta2/3/config.yaml",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/clash.meta2/4/config.yaml",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/clash.meta2/4/config.yaml",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/clash.meta2/5/config.yaml",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/clash.meta2/5/config.yaml",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/clash.meta2/6/config.yaml",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/clash.meta2/6/config.yaml",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/clash.meta2/1/config.yaml",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/clash.meta2/1/config.yaml",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/xray/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/xray/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/xray/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/xray/4/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/juicity/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/juicity/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/juicity/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/juicity/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/naiveproxy/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/naiveproxy/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/naiveproxy/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/naiveproxy/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/mieru/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/mieru/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/mieru/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/mieru/2/config.json"
];

const SUB_NAME = "SubLink";

// ==========================================
// 2. 主逻辑
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathPart = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();

    // 静态资源放行 (图片, js, css, etc.)
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
             // 简单的鉴权
             if (env.ADMIN_ID && chatId !== String(env.ADMIN_ID)) {
                 // 可选：静默或回复无权限
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
             // 检查 KV 是否绑定
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
    // 1. 确定订阅类型
    const queryType = url.searchParams.get('type');
    let targetType = queryType ? queryType.toLowerCase() : '';
    
    const knownTypes = ['vless', 'vmess', 'hysteria', 'hysteria2', 'trojan', 'ss', 'clash', 'all'];
    if (!targetType) {
        for(const t of knownTypes) {
            if(pathPart.includes(t)) targetType = t;
        }
    }
    if (!targetType) targetType = 'all';

    // 2. 获取数据
    let nodesData = [];
    try {
        if (env.KV) {
            const stored = await env.KV.get('NODES');
            if (stored) nodesData = JSON.parse(stored);
        }
    } catch(e) {}

    // 3. 过滤数据
    let filteredNodes = nodesData;
    if (targetType && targetType !== 'all') {
      const types = targetType.split(',').map(t => t.trim());
      filteredNodes = nodesData.filter(node => types.some(t => node.p.includes(t)));
    }

    // 4. 生成 Base64
    const links = filteredNodes.map(n => n.l).join('\n');
    const encoded = btoa(links);

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
    
    // 发送消息助手函数 (带默认键盘)
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
    
    // 发送图片助手函数
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

    // --- 指令路由 ---
    
    // 1. 帮助 / 启动
    if (text === '/start' || text.includes('帮助')) {
        await send(
            `👋 <b>欢迎使用 SubLink 管理机器人</b>\n\n` +
            `请使用下方键盘菜单进行操作：\n\n` +
            `🔄 <b>立即更新</b>: 抓取最新节点并缓存\n` +
            `📊 <b>系统状态</b>: 查看当前节点数和更新时间\n` +
            `🔗 <b>订阅链接</b>: 获取订阅地址和二维码\n` +
            `⚙️ <b>检测配置</b>: 检查 KV 和 环境变量`
        );
    } 
    
    // 2. 更新节点
    else if (text === '/update' || text.includes('立即更新')) {
        if (!env.KV) {
            await send(`❌ <b>错误</b>: 未绑定 KV Namespace。\n请在 Cloudflare Pages 后台设置中绑定名为 <code>KV</code> 的命名空间。`);
            return;
        }

        await send("⏳ <b>正在抓取...</b>\n正在从 50+ 个订阅源聚合节点，这可能需要 10-20 秒。");
        const startTime = Date.now();
        
        try {
            const nodes = await fetchAndParseAll(PRESET_URLS);
            
            if (nodes.length === 0) {
                 await send(`⚠️ <b>警告</b>: 抓取完成，但没有找到有效节点。可能是源站网络问题。`);
                 return;
            }

            // 存入 KV
            await env.KV.put('NODES', JSON.stringify(nodes));
            
            // 存入 更新时间 (北京时间)
            const now = new Date();
            // 简单的 UTC+8 计算
            const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
            await env.KV.put('LAST_UPDATE', beijingTime);
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            await send(`✅ <b>更新成功!</b>\n\n📊 节点总数: <b>${nodes.length}</b>\n⏱️ 耗时: ${duration}秒\n📅 时间: ${beijingTime}\n\n前端页面已同步更新。`);
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
        } catch(e) {
            kvStatus = `❌ 异常 (${e.message})`;
        }
        
        await send(
            `📊 <b>系统状态报告</b>\n\n` +
            `🔢 <b>节点数量:</b> ${count}\n` +
            `🕒 <b>最后更新:</b> ${lastUp}\n` +
            `💾 <b>KV 存储:</b> ${kvStatus}\n` +
            `🤖 <b>Bot 服务:</b> ✅ 运行中`
        );
    } 
    
    // 4. 获取订阅
    else if (text === '/sub' || text.includes('订阅链接')) {
        const subUrl = `${origin}`;
        let msg = `🔗 <b>您的专属订阅链接</b>\n\n`;
        msg += `🌐 <b>全部节点 (通用):</b>\n<code>${subUrl}/all</code>\n\n`;
        msg += `🚀 <b>VLESS 专线:</b>\n<code>${subUrl}/vless</code>\n\n`;
        msg += `⚡ <b>Hysteria2:</b>\n<code>${subUrl}/hysteria2</code>\n\n`;
        msg += `🐱 <b>Clash Meta:</b>\n<code>${subUrl}/clash</code>`;
        
        await send(msg);
        
        // 生成二维码图片
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(subUrl + '/all')}`;
        await sendPhoto(qrApi, '📱 扫码直接导入 (包含所有节点)');
    }
    
    // 5. 检测配置
    else if (text.includes('检测配置')) {
         let report = `⚙️ <b>配置检测</b>\n\n`;
         report += `1️⃣ <b>KV Binding:</b> ${env.KV ? '✅ 已绑定' : '❌ 未绑定 (变量名应为 KV)'}\n`;
         report += `2️⃣ <b>TG_TOKEN:</b> ${env.TG_TOKEN ? '✅ 已设置' : '❌ 未设置'}\n`;
         report += `3️⃣ <b>ADMIN_ID:</b> ${env.ADMIN_ID ? `✅ 已设置 (${env.ADMIN_ID})` : '⚠️ 未设置 (任何人均可操作Bot)'}\n`;
         await send(report);
    }
    
    // 6. 未知指令
    else {
        // 如果是群组消息，通常忽略未知指令以免刷屏；如果是私聊，可以提示
        // await send("❓ 未知指令，请使用键盘菜单操作。");
    }
}

// ==========================================
// 4. 节点抓取核心逻辑
// ==========================================
async function fetchAndParseAll(urls) {
    const nodes = [];
    // 适度并发，避免 Cloudflare 资源限制
    const BATCH_SIZE = 5; 
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            try {
                const res = await fetch(u, { 
                    headers: { 'User-Agent': 'ClashMeta/1.0' },
                    cf: { cacheTtl: 60 }
                });
                if (!res.ok) return;
                const text = await res.text();
                
                // 正则提取所有常见协议链接
                // 支持: vmess://, vless://, trojan://, ss://, hysteria2://, tuic://
                // 排除: 包含空格的, 非链接格式的
                const regex = /(vmess|vless|trojan|ss|hysteria2|tuic):\/\/[^\s"',;<>]+/g;
                const matches = text.match(regex);
                
                if (matches) {
                    matches.forEach(link => {
                         // 简单的清洗
                         let cleanLink = link.split('"')[0].split("'")[0].split("<")[0];
                         
                         // 尝试提取节点名称 (Hash部分)
                         let n = 'Node';
                         let p = cleanLink.split('://')[0];
                         try { 
                             const hashPart = cleanLink.split('#')[1];
                             if(hashPart) n = decodeURIComponent(hashPart); 
                         } catch(e){}
                         
                         nodes.push({ l: cleanLink, p: p, n: n });
                    });
                } else if (text.length > 50 && !text.includes(' ') && !text.includes('<')) {
                     // 尝试 Base64 解码 (兜底)
                     try {
                         const decoded = atob(text.trim());
                         const subMatches = decoded.match(regex);
                         if(subMatches) {
                             subMatches.forEach(link => {
                                 let p = link.split('://')[0];
                                 nodes.push({ l: link, p: p, n: 'Base64_Node' });
                             });
                         }
                     } catch(e) {}
                }
            } catch(e) {
                // 单个源失败不影响整体
            }
        });
        await Promise.all(promises);
    }
    
    // 去重 (根据链接内容)
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