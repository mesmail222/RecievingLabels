import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { Home } from 'lucide-react';
import { VIEW_LABELS } from '../config/views';
import type { ViewKey } from '../config/views';

interface BreadcrumbsProps {
  activeView: ViewKey;
  onHomeClick?: () => void;
}

export function Breadcrumbs({ activeView, onHomeClick }: BreadcrumbsProps) {
  const currentLabel = VIEW_LABELS[activeView] || 'Dashboard';

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            href="#"
            className="flex items-center gap-1"
            onClick={(e) => {
              if (onHomeClick) {
                e.preventDefault();
                onHomeClick();
              }
            }}
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
