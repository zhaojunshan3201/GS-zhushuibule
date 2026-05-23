export type PageType =
  | 'home'
  | 'welcome'
  | 'dynamic-analysis'
  | 'well-history'
  | 'water-cut'
  | 'injection-tech'
  | 'zonal-injection'
  | 'concentric-test-history'
  | 'smart-test-history'
  | 'single-well-injection-evaluation'
  | 'single-well-seal-evaluation'
  | 'zonal-indicator-summary'
  | 'well-flushing'
  | 'abnormal-wells'
  | 'dynamic-adjustment'
  | 'indicator-curve'
  | 'user-management'
  | 'settings'
  | 'audit-log'
  | 'key-matters';

export type RouteUserRole = 'ADMIN' | 'ANALYST' | 'OPERATOR';

export interface NavItem {
  id: PageType;
  label: string;
}

export interface RouteConfig extends NavItem {
  requiresAdmin?: boolean;
  showInQuickAccess?: boolean;
  showInNav?: boolean;
}

export const ROUTE_CONFIGS: RouteConfig[] = [
  { id: 'welcome', label: '欢迎', showInQuickAccess: false, showInNav: false },
  { id: 'home', label: '主页', showInQuickAccess: false, showInNav: true },
  { id: 'key-matters', label: '重点事项中心', requiresAdmin: true, showInQuickAccess: false, showInNav: false },
  { id: 'dynamic-analysis', label: '动态分析', showInQuickAccess: true, showInNav: true },
  { id: 'well-history', label: '单井井史', showInQuickAccess: true, showInNav: true },
  { id: 'water-cut', label: '含水化验', showInQuickAccess: true, showInNav: true },
  { id: 'injection-tech', label: '注水工艺', showInQuickAccess: true, showInNav: true },
  { id: 'zonal-injection', label: '分注管理', showInQuickAccess: true, showInNav: true },
  { id: 'concentric-test-history', label: '同心测调井史', showInQuickAccess: false, showInNav: false },
  { id: 'smart-test-history', label: '智能测调井史', showInQuickAccess: false, showInNav: false },
  { id: 'single-well-injection-evaluation', label: '单井注入评价', showInQuickAccess: false, showInNav: false },
  { id: 'single-well-seal-evaluation', label: '单井密封评价', showInQuickAccess: false, showInNav: false },
  { id: 'zonal-indicator-summary', label: '分注指标汇总', showInQuickAccess: false, showInNav: false },
  { id: 'well-flushing', label: '水井洗井', showInQuickAccess: true, showInNav: true },
  { id: 'abnormal-wells', label: '异常水井', showInQuickAccess: true, showInNav: true },
  { id: 'dynamic-adjustment', label: '动态调配', showInQuickAccess: true, showInNav: true },
  { id: 'indicator-curve', label: '指示曲线', showInQuickAccess: true, showInNav: true },
  { id: 'user-management', label: '用户管理', requiresAdmin: true, showInQuickAccess: false, showInNav: false },
  { id: 'settings', label: '系统设置', requiresAdmin: true, showInQuickAccess: false, showInNav: false },
  { id: 'audit-log', label: '审计日志', requiresAdmin: true, showInQuickAccess: false, showInNav: false },
];

export const ROUTE_CONFIG_BY_ID = ROUTE_CONFIGS.reduce<Record<PageType, RouteConfig>>((acc, route) => {
  acc[route.id] = route;
  return acc;
}, {} as Record<PageType, RouteConfig>);

export const NAV_ITEMS: NavItem[] = ROUTE_CONFIGS.map(({ id, label }) => ({ id, label }));

export const canAccessPage = (page: PageType, role?: RouteUserRole | null) => {
  const route = ROUTE_CONFIG_BY_ID[page];
  return !route.requiresAdmin || role === 'ADMIN';
};

export const getAccessibleNavItems = (role?: RouteUserRole | null) =>
  ROUTE_CONFIGS
    .filter((route) => route.showInNav && canAccessPage(route.id, role))
    .map(({ id, label }) => ({ id, label }));

export const getQuickAccessNavItems = (role?: RouteUserRole | null) =>
  ROUTE_CONFIGS
    .filter((route) => route.showInQuickAccess && canAccessPage(route.id, role))
    .map(({ id, label }) => ({ id, label }));

export const getRouteLabel = (page: PageType) => ROUTE_CONFIG_BY_ID[page]?.label || NAV_ITEMS[0].label;
