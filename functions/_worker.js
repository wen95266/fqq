/**
 * Cloudflare Pages Functions - SubLink 简洁高效版
 * 修复卡顿和静态资源显示问题
 */

// ==========================================
// 1. 配置区域
// ==========================================

const BOT_KEYBOARD = {
    keyboard: [
        [{ text: "🔄 立即更新" }, { text: "📊 系统状态" }],
        [{ text: "🔗 订阅链接" }, { text: "⚙️ 检测配置" }]
    ],
    resize_keyboard: true,
    is_persistent: true
};

// 精简有效的订阅源
const PRESET_URLS = [
  // 标准订阅源
  "https://raw.githubusercontent.com/freefq/free/master/v2",
  "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/clash.yml",
  "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2",
  
  // 简单配置源
  "https://proxy.yugogo.xyz/vmess/sub",
  "https://proxypool.fly.dev/clash/proxies"
];

const SUB_NAME = "SubLink";

// ==========================================
// 2. 主函数 - 修复静态资源问题
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 处理静态资源 - 先检查是否为资源请求
    if (pathname.includes('.') && !pathname.includes('/api/')) {
      // 常见的静态文件扩展名
      const staticExtensions = ['.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.json', '.txt', '.xml'];
      const isStatic = staticExtensions.some(ext => pathname.endsWith(ext));
      
      if (isStatic) {
        return env.ASSETS.fetch(request);
      }
    }
    
    // 处理根路径 - 返回简单前端页面
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(generateIndexPage(url.origin), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    const pathPart = pathname.replace(/^\/|\/$/g, '').toLowerCase();
    
    // Webhook 设置
    if (pathPart === 'webhook') {
      if (!env.TG_TOKEN) {
        return new Response('❌ Error: TG_TOKEN not set.', { status: 500 });
      }
      const webhookUrl = `${url.origin}/api/telegram`;
      try {
        const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/setWebhook?url=${webhookUrl}`);
        const j = await r.json();
        return new Response(`Webhook: ${webhookUrl}\nResult: ${JSON.stringify(j, null, 2)}`, {
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }
    
    // Bot API
    if (pathPart === 'api/telegram' && request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
          const chatId = String(update.message.from.id);
          if (env.ADMIN_ID && chatId !== String(env.ADMIN_ID)) {
            return new Response('OK');
          }
          ctx.waitUntil(handleTelegramCommand(update.message, env, url.origin));
        }
      } catch (e) {
        console.error('Telegram webhook error:', e);
      }
      return new Response('OK');
    }
    
    // 状态 API
    if (pathPart === 'api/status') {
      let count = 0;
      let updateTime = null;
      try {
        if (env.KV) {
          const stored = await env.KV.get('NODES');
          if (stored) {
            const nodes = JSON.parse(stored);
            count = nodes.length;
          }
          updateTime = await env.KV.get('LAST_UPDATE');
        }
      } catch (e) {}
      
      return new Response(JSON.stringify({ 
        count, 
        last_update: updateTime || '等待更新...',
        bot_ready: !!env.TG_TOKEN,
        kv_ready: !!env.KV
      }), { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      });
    }
    
    // 订阅输出 - 简化处理
    let targetType = 'all';
    const queryType = url.searchParams.get('type');
    if (queryType) targetType = queryType.toLowerCase();
    
    // 从路径推断类型
    if (pathPart.includes('hysteria2')) targetType = 'hysteria2';
    else if (pathPart.includes('hysteria')) targetType = 'hysteria';
    else if (pathPart.includes('vless')) targetType = 'vless';
    else if (pathPart.includes('vmess')) targetType = 'vmess';
    else if (pathPart.includes('trojan')) targetType = 'trojan';
    else if (pathPart.includes('ss')) targetType = 'ss';
    else if (pathPart.includes('clash')) targetType = 'clash';
    else if (pathPart.includes('singbox')) targetType = 'singbox';
    
    // 获取节点数据
    let nodesData = [];
    try {
      if (env.KV) {
        const stored = await env.KV.get('NODES');
        if (stored) {
          nodesData = JSON.parse(stored);
        }
      }
    } catch (e) {
      console.error('Error reading nodes:', e);
    }
    
    // 过滤节点
    let filteredNodes = nodesData;
    if (targetType && targetType !== 'all') {
      const types = targetType.split(',').map(t => t.trim());
      filteredNodes = nodesData.filter(node => node && node.p && types.includes(node.p));
    }
    
    // 确保节点有效
    filteredNodes = filteredNodes.filter(n => n && n.l && n.p);
    
    // 如果是 Clash 格式请求
    if (targetType === 'clash') {
      const clashConfig = generateClashConfig(filteredNodes);
      return new Response(clashConfig, {
        headers: {
          "Content-Type": "text/yaml; charset=utf-8",
          "Content-Disposition": `inline; filename="${SUB_NAME}_clash.yaml"`,
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }
    
    // 如果是 Sing-box 格式请求
    if (targetType === 'singbox') {
      const singboxConfig = generateSingboxConfig(filteredNodes);
      return new Response(JSON.stringify(singboxConfig, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `inline; filename="${SUB_NAME}_singbox.json"`,
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }
    
    // 默认：普通订阅链接
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
// 3. 生成前端页面
// ==========================================
function generateIndexPage(origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SubLink 订阅服务</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .tagline {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        
        main {
            padding: 30px;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid #e9ecef;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: #6c757d;
            font-size: 0.9em;
        }
        
        .links {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .links h2 {
            margin-bottom: 15px;
            color: #495057;
        }
        
        .link-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
        }
        
        .link-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .link-item:hover {
            border-color: #667eea;
        }
        
        .link-name {
            font-weight: 500;
            color: #495057;
        }
        
        .copy-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 5px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background 0.3s ease;
        }
        
        .copy-btn:hover {
            background: #5a67d8;
        }
        
        .instructions {
            background: #e3f2fd;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .instructions h2 {
            margin-bottom: 15px;
            color: #1976d2;
        }
        
        .instructions ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
        
        footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9em;
            border-top: 1px solid #e9ecef;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 10px;
            }
            
            header {
                padding: 30px 20px;
            }
            
            h1 {
                font-size: 2em;
            }
            
            main {
                padding: 20px;
            }
            
            .stat-card {
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🌐 SubLink 订阅服务</h1>
            <p class="tagline">高效稳定的多协议订阅聚合服务</p>
        </header>
        
        <main>
            <div class="stats" id="stats">
                <div class="stat-card">
                    <div class="stat-value">--</div>
                    <div class="stat-label">节点总数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">--</div>
                    <div class="stat-label">最后更新</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">🟢</div>
                    <div class="stat-label">服务状态</div>
                </div>
            </div>
            
            <div class="links">
                <h2>📥 订阅链接</h2>
                <div class="link-grid" id="links">
                    <!-- 链接将由JavaScript动态生成 -->
                </div>
            </div>
            
            <div class="instructions">
                <h2>📖 使用说明</h2>
                <ol>
                    <li>点击上方按钮复制订阅链接</li>
                    <li>在客户端添加订阅地址</li>
                    <li>选择节点开始使用</li>
                    <li>定期更新获取最新节点</li>
                </ol>
                <p><strong>支持协议：</strong> VLESS、VMess、Trojan、Hysteria、Hysteria2、Shadowsocks</p>
            </div>
        </main>
        
        <footer>
            <p>© 2023 SubLink 订阅服务 | 自动更新 | 多协议支持</p>
            <p>数据来源：公开订阅源 | 每24小时自动更新</p>
        </footer>
    </div>
    
    <script>
        // 获取服务状态
        async function loadStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                // 更新统计
                document.querySelectorAll('.stat-value')[0].textContent = data.count || '0';
                document.querySelectorAll('.stat-value')[1].textContent = data.last_update || '等待更新';
                document.querySelectorAll('.stat-value')[2].textContent = data.bot_ready && data.kv_ready ? '🟢' : '🔴';
                
                // 生成链接
                const linksContainer = document.getElementById('links');
                const baseUrl = window.location.origin;
                const protocols = [
                    { name: '全部节点', path: '/all' },
                    { name: 'VLESS', path: '/vless' },
                    { name: 'VMess', path: '/vmess' },
                    { name: 'Trojan', path: '/trojan' },
                    { name: 'Hysteria', path: '/hysteria' },
                    { name: 'Hysteria2', path: '/hysteria2' },
                    { name: 'Shadowsocks', path: '/ss' },
                    { name: 'Clash 配置', path: '/clash' },
                    { name: 'Sing-box 配置', path: '/singbox' }
                ];
                
                linksContainer.innerHTML = protocols.map(proto => \`
                    <div class="link-item">
                        <span class="link-name">\${proto.name}</span>
                        <button class="copy-btn" onclick="copyToClipboard('\${baseUrl}\${proto.path}')">
                            复制
                        </button>
                    </div>
                \`).join('');
                
            } catch (error) {
                console.error('加载状态失败:', error);
                document.querySelectorAll('.stat-value')[2].textContent = '🔴';
            }
        }
        
        // 复制到剪贴板
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = '复制';
                const buttons = document.querySelectorAll('.copy-btn');
                buttons.forEach(btn => {
                    if (btn.textContent === '复制') {
                        const original = btn.textContent;
                        btn.textContent = '已复制!';
                        btn.style.background = '#10b981';
                        setTimeout(() => {
                            btn.textContent = original;
                            btn.style.background = '#667eea';
                        }, 2000);
                    }
                });
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制链接');
            });
        }
        
        // 页面加载完成后执行
        document.addEventListener('DOMContentLoaded', loadStatus);
        
        // 每30秒刷新状态
        setInterval(loadStatus, 30000);
    </script>
</body>
</html>`;
}

// ==========================================
// 4. Telegram Bot 逻辑
// ==========================================
async function handleTelegramCommand(message, env, origin) {
    const chatId = message.chat.id;
    const text = message.text.trim();
    
    const send = async (msg) => {
        await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId, 
                text: msg, 
                parse_mode: 'HTML', 
                disable_web_page_preview: true,
                reply_markup: BOT_KEYBOARD
            })
        });
    };

    if (text.includes('立即更新') || text.includes('/update')) {
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。`);
        
        await send("⏳ <b>正在更新...</b>\n正在从订阅源抓取节点...");
        const start = Date.now();
        
        try {
            // 设置超时
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('更新超时 (30秒)')), 30000)
            );
            
            const updatePromise = (async () => {
                const nodes = await fetchAndParseAll(PRESET_URLS);
                
                if (nodes.length === 0) {
                    throw new Error('未找到任何有效节点');
                }

                await env.KV.put('NODES', JSON.stringify(nodes));
                const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
                await env.KV.put('LAST_UPDATE', time);
                
                const stats = {};
                nodes.forEach(n => { 
                    if (n && n.p) stats[n.p] = (stats[n.p] || 0) + 1; 
                });
                
                const statsStr = Object.entries(stats)
                    .map(([k, v]) => `• <b>${k.toUpperCase()}</b>: ${v}`)
                    .join('\n');
                
                return `✅ <b>更新成功</b>\n\n📊 <b>节点总数:</b> ${nodes.length}\n${statsStr}\n\n⏱️ 耗时: ${((Date.now()-start)/1000).toFixed(1)}s\n🕒 时间: ${time}`;
            })();
            
            const result = await Promise.race([updatePromise, timeoutPromise]);
            await send(result);
            
        } catch (e) {
            await send(`❌ <b>更新失败:</b> ${e.message}\n\n请稍后重试或检查订阅源。`);
        }

    } else if (text.includes('系统状态') || text.includes('/status')) {
        let count = 0;
        let last = "无";
        let statsStr = "暂无数据";
        
        if (env.KV) {
            const s = await env.KV.get('NODES');
            if(s) {
                const nodes = JSON.parse(s);
                count = nodes.length;
                const stats = {};
                nodes.forEach(n => { 
                    if (n && n.p) stats[n.p] = (stats[n.p] || 0) + 1; 
                });
                statsStr = Object.entries(stats)
                    .map(([k, v]) => `• <b>${k.toUpperCase()}</b>: ${v}`)
                    .join('\n');
            }
            last = await env.KV.get('LAST_UPDATE') || "无";
        }
        await send(`📊 <b>系统状态</b>\n\n🟢 <b>节点总数:</b> ${count}\n\n${statsStr}\n\n🕒 <b>上次更新:</b> ${last}`);

    } else if (text.includes('订阅链接') || text.includes('/links')) {
        const msg = [
            `🔗 <b>订阅链接</b>`,
            `<code>${origin}/all</code> - 所有节点`,
            `<code>${origin}/hysteria</code> - Hysteria 节点`,
            `<code>${origin}/hysteria2</code> - Hysteria2 节点`,
            `<code>${origin}/vless</code> - VLESS 节点`,
            `<code>${origin}/vmess</code> - VMess 节点`,
            `<code>${origin}/clash</code> - Clash 配置`,
            `<code>${origin}/singbox</code> - Sing-box 配置`
        ].join('\n');
        await send(msg);

    } else if (text.includes('检测配置') || text.includes('/check')) {
        await send(`⚙️ <b>配置检测</b>\n\nKV: ${env.KV?'✅':'❌'}\nToken: ${env.TG_TOKEN?'✅':'❌'}\nAdmin: ${env.ADMIN_ID?'✅':'❌'}\n\n引擎: 简洁高效版`);

    } else {
        await send(`👋 <b>SubLink Bot</b>\n\n支持协议: Hysteria2, Hysteria, VLESS, VMess, Trojan, SS\n\n请选择操作:`);
    }
}

// ==========================================
// 5. 简洁高效的节点获取逻辑
// ==========================================
async function fetchAndParseAll(urls) {
    const allNodes = [];
    
    // 限制并发数，避免阻塞
    const batchSize = 3;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const promises = batch.map(async (url) => {
            try {
                return await parseSingleSource(url);
            } catch (e) {
                console.log(`解析 ${url} 失败:`, e.message);
                return [];
            }
        });
        
        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                allNodes.push(...result.value);
            }
        }
        
        // 批次之间延迟
        if (i + batchSize < urls.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // 去重
    const uniqueNodes = [];
    const seen = new Set();
    
    for (const node of allNodes) {
        if (!node || !node.l || !node.p) continue;
        
        const key = `${node.p}:${node.l}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueNodes.push(node);
        }
    }
    
    console.log(`总计找到 ${uniqueNodes.length} 个节点`);
    return uniqueNodes;
}

async function parseSingleSource(url) {
    console.log(`开始解析: ${url}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        let text = await response.text();
        text = text.trim();
        
        if (!text) {
            throw new Error('空响应');
        }
        
        // 尝试解析为 JSON
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                const data = JSON.parse(text);
                return extractNodesFromObject(data);
            } catch (e) {
                // 不是有效的 JSON
            }
        }
        
        // 尝试解析为 YAML（简单的 Clash 格式）
        if (text.includes('proxies:')) {
            return extractNodesFromClashYAML(text);
        }
        
        // 尝试 Base64 解码
        if (!text.includes(' ') && !text.includes('\n') && text.length > 10) {
            try {
                const decoded = safeAtob(text);
                if (decoded && decoded.length > 10) {
                    // 尝试解析解码后的内容
                    if (decoded.startsWith('{') || decoded.startsWith('[')) {
                        try {
                            const data = JSON.parse(decoded);
                            return extractNodesFromObject(data);
                        } catch (e) {}
                    }
                    
                    if (decoded.includes('proxies:')) {
                        return extractNodesFromClashYAML(decoded);
                    }
                    
                    // 直接提取链接
                    return extractLinksFromText(decoded);
                }
            } catch (e) {
                // 不是有效的 Base64
            }
        }
        
        // 最后尝试直接提取链接
        return extractLinksFromText(text);
        
    } catch (error) {
        console.error(`解析 ${url} 失败:`, error.message);
        return [];
    }
}

function extractNodesFromObject(obj) {
    const nodes = [];
    
    if (!obj || typeof obj !== 'object') return nodes;
    
    // 如果是数组，遍历每个元素
    if (Array.isArray(obj)) {
        for (const item of obj) {
            nodes.push(...extractNodesFromObject(item));
        }
        return nodes;
    }
    
    // 检查常见字段
    if (obj.outbounds && Array.isArray(obj.outbounds)) {
        for (const outbound of obj.outbounds) {
            const node = parseSingboxOutbound(outbound);
            if (node) nodes.push(node);
        }
    }
    
    if (obj.proxies && Array.isArray(obj.proxies)) {
        for (const proxy of obj.proxies) {
            const node = parseClashProxy(proxy);
            if (node) nodes.push(node);
        }
    }
    
    // 尝试从任意对象中解析节点
    const node = parseGenericNode(obj);
    if (node) nodes.push(node);
    
    return nodes;
}

function parseGenericNode(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    // 获取基本字段
    const server = obj.server || obj.address || obj.host;
    const port = obj.port;
    const type = (obj.type || obj.protocol || '').toLowerCase();
    const name = obj.name || obj.ps || obj.tag || `${type}-node`;
    
    if (!server || !port || !type) return null;
    
    try {
        // Hysteria2
        if (type === 'hysteria2') {
            const password = obj.password || obj.auth_str || '';
            const params = new URLSearchParams();
            
            if (obj.sni) params.set('sni', obj.sni);
            if (obj.insecure) params.set('insecure', '1');
            
            const link = `hysteria2://${encodeURIComponent(password)}@${server}:${port}?${params}#${encodeURIComponent(name)}`;
            return { l: link, p: 'hysteria2', n: name };
        }
        
        // Hysteria
        if (type === 'hysteria') {
            const params = new URLSearchParams();
            params.set('peer', obj.sni || server);
            if (obj.insecure) params.set('insecure', '1');
            
            const up = obj.up || obj.up_mbps || '100';
            const down = obj.down || obj.down_mbps || '100';
            params.set('up', up.toString());
            params.set('down', down.toString());
            
            if (obj.auth_str || obj.password) {
                params.set('auth', encodeURIComponent(obj.auth_str || obj.password));
            }
            
            const link = `hysteria://${server}:${port}?${params}#${encodeURIComponent(name)}`;
            return { l: link, p: 'hysteria', n: name };
        }
        
        // VLESS
        if (type === 'vless') {
            const params = new URLSearchParams();
            params.set('encryption', 'none');
            
            if (obj.tls) params.set('security', 'tls');
            if (obj.sni) params.set('sni', obj.sni);
            
            const link = `vless://${obj.uuid || obj.id}@${server}:${port}?${params}#${encodeURIComponent(name)}`;
            return { l: link, p: 'vless', n: name };
        }
        
        // VMess
        if (type === 'vmess') {
            const vmess = {
                v: "2",
                ps: name,
                add: server,
                port: port,
                id: obj.uuid || obj.id,
                aid: obj.alterId || obj.aid || 0,
                scy: obj.cipher || "auto",
                net: obj.network || "tcp",
                type: "none",
                host: "",
                path: "",
                tls: obj.tls ? "tls" : ""
            };
            
            const encoded = safeBtoa(JSON.stringify(vmess));
            return { l: `vmess://${encoded}`, p: 'vmess', n: name };
        }
        
        // Trojan
        if (type === 'trojan') {
            const params = new URLSearchParams();
            if (obj.sni) params.set('sni', obj.sni);
            
            const link = `trojan://${encodeURIComponent(obj.password)}@${server}:${port}?${params}#${encodeURIComponent(name)}`;
            return { l: link, p: 'trojan', n: name };
        }
        
        // Shadowsocks
        if (type === 'ss' || type === 'shadowsocks') {
            const method = obj.method || obj.cipher;
            const password = obj.password;
            
            if (method && password) {
                const auth = `${method}:${password}`;
                const link = `ss://${safeBtoa(auth)}@${server}:${port}#${encodeURIComponent(name)}`;
                return { l: link, p: 'ss', n: name };
            }
        }
        
    } catch (e) {
        console.error('解析节点失败:', e);
    }
    
    return null;
}

function extractNodesFromClashYAML(text) {
    const nodes = [];
    const lines = text.split('\n');
    let inProxies = false;
    let proxyObj = {};
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const currentIndent = line.search(/\S/);
        
        // 开始 proxies 部分
        if (trimmed === 'proxies:') {
            inProxies = true;
            indentLevel = currentIndent;
            continue;
        }
        
        // 不在 proxies 部分或遇到同级缩进的其他部分
        if (!inProxies || (currentIndent <= indentLevel && trimmed && !trimmed.startsWith('-'))) {
            inProxies = false;
            continue;
        }
        
        // 处理代理项
        if (inProxies) {
            // 新代理开始
            if (trimmed.startsWith('- ')) {
                if (Object.keys(proxyObj).length > 0) {
                    const node = parseClashProxy(proxyObj);
                    if (node) nodes.push(node);
                    proxyObj = {};
                }
                
                // 解析行内对象
                const inlineObj = trimmed.substring(2);
                if (inlineObj.includes(':')) {
                    const [key, value] = inlineObj.split(': ', 2);
                    proxyObj[key.trim()] = value.trim();
                }
            } 
            // 代理属性
            else if (currentIndent > indentLevel && trimmed.includes(':')) {
                const colonIndex = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIndex).trim();
                let value = trimmed.substring(colonIndex + 1).trim();
                
                // 处理可能的多行值
                if (value === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
                    // 数组值
                    const arrayValues = [];
                    i++;
                    while (i < lines.length && lines[i].trim().startsWith('- ')) {
                        arrayValues.push(lines[i].trim().substring(2));
                        i++;
                    }
                    i--; // 回退一行
                    value = arrayValues;
                }
                
                proxyObj[key] = value;
            }
        }
    }
    
    // 处理最后一个代理
    if (Object.keys(proxyObj).length > 0) {
        const node = parseClashProxy(proxyObj);
        if (node) nodes.push(node);
    }
    
    return nodes;
}

function parseClashProxy(proxy) {
    if (!proxy || typeof proxy !== 'object') return null;
    
    const type = (proxy.type || '').toLowerCase();
    const name = proxy.name || `${type}-node`;
    const server = proxy.server;
    const port = proxy.port;
    
    if (!server || !port) return null;
    
    // 使用通用解析器
    return parseGenericNode({
        ...proxy,
        type: type,
        name: name,
        server: server,
        port: port
    });
}

function extractLinksFromText(text) {
    const nodes = [];
    const protocols = ['vmess', 'vless', 'trojan', 'ss', 'hysteria2', 'hysteria'];
    
    for (const protocol of protocols) {
        const regex = new RegExp(`${protocol}://[^\\s"',;<>]+`, 'gi');
        const matches = text.match(regex);
        
        if (matches) {
            matches.forEach(link => {
                try {
                    const cleanLink = link.trim();
                    let name = `${protocol}-node`;
                    
                    // 从链接中提取名称
                    const hashIndex = cleanLink.indexOf('#');
                    if (hashIndex !== -1) {
                        try {
                            name = decodeURIComponent(cleanLink.substring(hashIndex + 1));
                        } catch (e) {
                            name = cleanLink.substring(hashIndex + 1);
                        }
                    }
                    
                    nodes.push({ l: cleanLink, p: protocol, n: name });
                } catch (e) {
                    console.error('解析链接失败:', link, e);
                }
            });
        }
    }
    
    return nodes;
}

// ==========================================
// 6. 生成配置文件的辅助函数
// ==========================================
function generateClashConfig(nodes) {
    const proxies = nodes.map(node => {
        const url = new URL(node.l);
        const protocol = url.protocol.replace(':', '');
        
        if (protocol === 'vmess') {
            try {
                const decoded = safeAtob(url.hostname);
                const vmess = JSON.parse(decoded);
                return {
                    name: node.n,
                    type: 'vmess',
                    server: vmess.add,
                    port: vmess.port,
                    uuid: vmess.id,
                    alterId: vmess.aid,
                    cipher: vmess.scy,
                    network: vmess.net,
                    tls: vmess.tls === 'tls',
                    'skip-cert-verify': true,
                    servername: vmess.sni || '',
                    ws-opts: vmess.net === 'ws' ? {
                        path: vmess.path,
                        headers: { Host: vmess.host }
                    } : {}
                };
            } catch (e) {
                return null;
            }
        }
        
        return null;
    }).filter(p => p !== null);
    
    return `port: 7890
socks-port: 7891
redir-port: 7892
allow-lan: false
mode: Rule
log-level: info
external-controller: 127.0.0.1:9090

proxies:
${proxies.map(p => `  - ${JSON.stringify(p)}`).join('\n')}

proxy-groups:
  - name: 🚀 节点选择
    type: select
    proxies:
      - ♻️ 自动选择
      - 🎯 全球直连
      - DIRECT
${proxies.map(p => `      - ${p.name}`).join('\n')}

  - name: ♻️ 自动选择
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    proxies:
${proxies.map(p => `      - ${p.name}`).join('\n')}

  - name: 🎯 全球直连
    type: select
    proxies:
      - DIRECT
      - 🚀 节点选择

rules:
  - DOMAIN-SUFFIX,google.com,🚀 节点选择
  - DOMAIN-KEYWORD,github,🚀 节点选择
  - IP-CIDR,127.0.0.0/8,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,🚀 节点选择`;
}

function generateSingboxConfig(nodes) {
    const outbounds = nodes.map(node => {
        const url = new URL(node.l);
        const protocol = url.protocol.replace(':', '');
        
        if (protocol === 'vmess') {
            try {
                const decoded = safeAtob(url.hostname);
                const vmess = JSON.parse(decoded);
                return {
                    type: 'vmess',
                    tag: node.n,
                    server: vmess.add,
                    server_port: vmess.port,
                    uuid: vmess.id,
                    security: vmess.scy,
                    alter_id: vmess.aid,
                    transport: {
                        type: vmess.net,
                        path: vmess.path,
                        headers: { Host: vmess.host }
                    },
                    tls: vmess.tls === 'tls' ? {
                        enabled: true,
                        server_name: vmess.sni || ''
                    } : undefined
                };
            } catch (e) {
                return null;
            }
        }
        
        return null;
    }).filter(p => p !== null);
    
    return {
        version: 1,
        log: { level: 'info' },
        dns: {
            servers: [
                { address: '8.8.8.8' },
                { address: '1.1.1.1' }
            ]
        },
        inbounds: [
            {
                type: 'mixed',
                tag: 'mixed-inbound',
                listen: '127.0.0.1',
                listen_port: 1080
            }
        ],
        outbounds: [
            {
                type: 'direct',
                tag: 'direct'
            },
            {
                type: 'block',
                tag: 'block'
            },
            ...outbounds
        ],
        route: {
            rules: [
                {
                    geoip: ['cn'],
                    outbound: 'direct'
                },
                {
                    geosite: ['cn'],
                    outbound: 'direct'
                },
                {
                    domain_keyword: ['google', 'github'],
                    outbound: outbounds[0]?.tag || 'direct'
                }
            ]
        }
    };
}

// ==========================================
// 7. 工具函数
// ==========================================
function safeBtoa(str) {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, 
            (match, p1) => String.fromCharCode(parseInt(p1, 16))
        ));
    } catch (e) {
        return btoa(str);
    }
}

function safeAtob(str) {
    try {
        str = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        const decoded = atob(str);
        return decodeURIComponent(decoded.split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
    } catch (e) {
        return atob(str);
    }
}
