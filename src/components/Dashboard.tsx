import { Tag, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { ViewKey } from '../config/views';

interface DashboardProps {
  onNavigate: (view: ViewKey) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Standalone Receiving labels for morning Manufacturing Orders.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Tag className="h-5 w-5" />
            </div>
            Kit Labels
          </CardTitle>
          <CardDescription>
            Replace handwritten bag info with printed stickers using Open MOs created that morning
            and Type N BOM components.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => onNavigate('receiving-labels')}>
            Open Receiving Labels
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
