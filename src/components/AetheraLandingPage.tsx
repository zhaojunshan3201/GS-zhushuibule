const navigationItems = [
  { label: "系统首页", href: "/?page=home" },
  { label: "动态分析", href: "/?page=dynamic-analysis" },
  { label: "单井井史", href: "/?page=well-history" },
  { label: "含水化验", href: "/?page=water-cut" },
];

export default function AetheraLandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-black">
      <img src="/aethera/oilfield-river.png" alt="油田河流航拍图" className="absolute inset-0 h-full w-full object-cover object-center animate-aethera-image-enter" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-center px-8 py-6">
        <div className="hidden items-center gap-8 text-sm sm:flex">
          {navigationItems.map((item) => <a key={item.label} href={item.href} className={item.label === "系统首页" ? "text-black transition-colors hover:text-[#1a5276]" : "text-[#6F6F6F] transition-colors hover:text-[#1a5276]"}>{item.label}</a>)}
        </div>
      </nav>
      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-40 pt-[calc(8rem-75px)]">
        <h1 className="max-w-7xl animate-fade-rise font-[Instrument_Serif] text-5xl font-bold leading-[.95] tracking-[-2.46px] sm:text-7xl md:text-8xl">注水管理平台</h1>
        <p className="mt-8 max-w-2xl animate-fade-rise-delay text-base font-bold leading-relaxed text-[#1a5276] sm:text-lg">注水管理平台聚焦生产运行全过程，集成动态分析、单井井史、含水化验与注水工艺等核心业务，为油田注水提供统一、精准、高效的数字化管理支撑。</p>
        <a href="/?page=home" className="mt-12 inline-block animate-fade-rise-delay-2 rounded-full bg-[#e67e22] px-14 py-5 text-base text-white transition-transform hover:scale-[1.03] hover:bg-[#c96b19]">进入注水管理系统</a>
      </main>
    </div>
  );
}
