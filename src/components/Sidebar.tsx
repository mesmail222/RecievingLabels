import {
  Tag,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from './ui/utils';
import type { ViewKey } from '../config/views';

interface SidebarProps {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: ViewKey;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavItemButton({
  item,
  groupLabel,
  isActive,
  collapsed,
  onViewChange,
}: {
  item: NavItem;
  groupLabel: string;
  isActive: boolean;
  collapsed: boolean;
  onViewChange: (view: ViewKey) => void;
}) {
  const Icon = item.icon;

  const button = (
    <button
      type="button"
      onClick={() => onViewChange(item.id)}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'w-full flex items-center gap-3 text-sm transition-colors relative',
        collapsed ? 'justify-center px-2 py-2.5' : 'px-4 py-2',
        isActive
          ? collapsed
            ? 'bg-blue-100 text-blue-700 font-medium rounded-lg mx-2'
            : 'bg-blue-50 text-blue-700 font-medium'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        collapsed && !isActive && 'mx-2 rounded-lg',
      )}
    >
      {isActive && !collapsed && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
      )}
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs">
        <p className="font-medium">{item.label}</p>
        <p className="text-[10px] opacity-75 mt-0.5">{groupLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  activeView,
  onViewChange,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const navGroups: NavGroup[] = [
    {
      label: 'OVERVIEW',
      items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'RECEIVING',
      items: [{ id: 'receiving-labels', label: 'Kit Labels', icon: Tag }],
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'bg-white border-r border-slate-200 flex flex-col transition-all duration-200 no-print',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div
          className={cn(
            'border-b border-slate-200 flex shrink-0',
            collapsed ? 'flex-col items-center gap-2 py-3 px-2' : 'h-16 items-center justify-between px-4',
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md shrink-0">
                <Tag className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-slate-900 font-semibold text-sm">GLoomis</h1>
                <p className="text-slate-500 text-xs truncate">MO Receiving Labels</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
              <Tag className="w-6 h-6 text-white" />
            </div>
          )}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navGroups.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(
                groupIndex > 0 && collapsed && 'border-t border-slate-200 pt-4 mt-2',
                !collapsed && 'mb-6',
              )}
            >
              {!collapsed && (
                <div className="px-4 mb-2">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </h2>
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItemButton
                    key={item.id}
                    item={item}
                    groupLabel={group.label}
                    isActive={activeView === item.id}
                    collapsed={collapsed}
                    onViewChange={onViewChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
