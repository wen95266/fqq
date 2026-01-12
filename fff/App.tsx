import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Zap, Server, Activity, ShieldCheck, QrCode, Globe, Clock, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

const App: React.FC = () => {
  const [deployDomain, setDeployDomain] = useState('');
  const [serverStatus, setServerStatus] = useState<{count: number, last_update: string, bot_ready: boolean, kv_ready?: boolean} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    // 客户端渲染时获取当前域名
    if (typeof window !== 'undefined' && window.location.origin) {
        setDeployDomain(window.location.origin);
        fetchStatus();
    }
  }, []);

  const fetchStatus = async () => {
      setIsLoading(true);
      try {
          // 获取后端状态
          const res = await fetch('/api/status');
          if (res.ok) {
              const data = await res.json();
              setServerStatus(data);
          } else {
              setServerStatus(null);
          }
      } catch (e) {
          console.error("Failed to fetch status");
      } finally {
          setIsLoading(false);
      }
  };

  const getSubLink = (path: string) => {
      if (!deployDomain) return '';
      const base = deployDomain.endsWith('/') ? deployDomain.slice(0, -1) : deployDomain;
      return `${base}/${path}`;
  };

  const handleCopy = (path: string) => {
      const link = getSubLink(path);
      if (!link) return;
      navigator.clipboard.writeText(link).then(() => {
          setCopiedPath(path);
          setTimeout(() => setCopiedPath(null), 2000);
      });
  };

  const qrValue = deployDomain ? getSubLink('all') : '';

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20 selection:bg-blue-500/30">
      
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/50">
              <Zap className="text-white h-5 w-5" />
            </div>
            <h1 className="font-bold text-lg text-white tracking-tight">SubLink Aggregator</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
             <div className={`w-2 h-2 rounded-full ${serverStatus?.bot_ready ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
             {serverStatus?.bot_ready ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        
        {/* 状态卡片区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 节点计数卡片 */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-xl group hover:border-blue-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Server size={80} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <Activity size={16} className="text-blue-400"/>
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">当前可用节点</h3>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-5xl font-bold text-white tracking-tight">
                        {serverStatus ? serverStatus.count : '--'}
                    </span>
                    <span className="text-sm text-gray-500">个</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-900/50 w-fit px-2 py-1 rounded border border-gray-800/50">
                    <Clock size={12} />
                    更新于: {serverStatus?.last_update || '未知'}
                </div>
            </div>

            {/* Bot 状态卡片 */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-xl group hover:border-green-500/30 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ShieldCheck size={80} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <Globe size={16} className="text-green-400"/>
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">控制中心</h3>
                </div>
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                         <div className={`p-1.5 rounded-full ${serverStatus?.bot_ready ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                             {serverStatus?.bot_ready ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                         </div>
                         <span className="text-sm font-medium text-gray-300">
                             {serverStatus?.bot_ready ? 'Bot 已连接' : 'Token 未配置'}
                         </span>
                    </div>
                    {/* KV 状态检查 */}
                    {serverStatus && serverStatus.kv_ready === false && (
                         <div className="flex items-center gap-3">
                             <div className="p-1.5 rounded-full bg-red-500/10 text-red-400">
                                 <AlertCircle size={18}/>
                             </div>
                             <span className="text-sm font-medium text-red-300">
                                 KV 未绑定 (重要)
                             </span>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 leading-relaxed pl-9">
                        {serverStatus?.bot_ready 
                            ? '已启用 Bot 键盘菜单，请在 Telegram 中点击 "🔄 立即更新" 来刷新节点缓存。' 
                            : '请在 Cloudflare Pages 后台添加环境变量 TG_TOKEN 和 ADMIN_ID。'}
                    </p>
                </div>
            </div>
        </div>

        {/* 订阅管理区 */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2 bg-gray-900/80">
                <QrCode size={18} className="text-blue-400"/>
                <h3 className="font-bold text-gray-200">订阅管理</h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 二维码展示 */}
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg shadow-black/20">
                    {qrValue ? (
                        <QRCode 
                            value={qrValue} 
                            size={180}
                            level="M"
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    ) : (
                         <div className="w-[180px] h-[180px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-300 text-xs">
                             Loading URL...
                         </div>
                    )}
                    <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">通用订阅 (Universal)</p>
                </div>

                {/* 订阅链接列表 */}
                <div className="space-y-4 flex flex-col justify-center">
                    <p className="text-sm text-gray-400 mb-2">
                        点击右侧按钮复制链接，然后在 v2rayNG, Shadowrocket 或 Clash 中添加订阅。
                    </p>
                    
                    {[
                        { label: '全部节点 (推荐)', path: 'all', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
                        { label: 'VLESS 专线', path: 'vless', color: 'text-teal-300 border-teal-500/30 bg-teal-500/10' },
                        { label: 'Hysteria2 低延迟', path: 'hysteria2', color: 'text-pink-300 border-pink-500/30 bg-pink-500/10' },
                        { label: 'Clash 配置文件', path: 'clash', color: 'text-purple-300 border-purple-500/30 bg-purple-500/10' },
                    ].map((item) => (
                        <div key={item.path} className="group relative">
                            <div className="flex justify-between items-center text-xs text-gray-500 mb-1 px-1">
                                <span>{item.label}</span>
                            </div>
                            <div className={`flex items-center gap-3 p-3 rounded-lg border bg-gray-950 transition-all ${serverStatus ? 'border-gray-800 hover:border-gray-600' : 'border-red-900/30 opacity-50'}`}>
                                <div className={`px-2 py-1 rounded text-xs font-mono font-bold border ${item.color}`}>
                                    /{item.path}
                                </div>
                                <div className="flex-1 truncate text-xs font-mono text-gray-400 select-all">
                                    {getSubLink(item.path)}
                                </div>
                                <button 
                                    onClick={() => handleCopy(item.path)}
                                    className={`p-2 rounded-md transition-all duration-200 flex items-center justify-center w-8 h-8 ${
                                        copiedPath === item.path 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                                    title="复制链接"
                                >
                                    {copiedPath === item.path ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 底部信息 */}
        <div className="text-center text-xs text-gray-600 py-6 border-t border-gray-800/50">
             <p className="mb-2">基于 Cloudflare Pages Functions 构建 · 无需外部服务器</p>
             <p className="opacity-50 font-mono">Build with React & Workers</p>
        </div>

      </main>
    </div>
  );
};

export default App;