import { CalendarDays, ChevronDown, Edit, FileText, Printer, Share2, Table } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FuelReportType } from '@/types/fuelReport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SignatureMode = 'with-signature' | 'without-signature';

type FuelRecapMenuProps = {
  signatureMode: SignatureMode;
  onSignatureChange: (mode: SignatureMode) => void;
  onPrint: () => void;
  onSharePdf: () => void | Promise<void>;
  onExportExcel: () => void;
  editItems: Array<{ id: string; label: string }>;
  reportType?: FuelReportType;
};

export default function FuelRecapMenu({ signatureMode, onSignatureChange, onPrint, onSharePdf, onExportExcel, editItems, reportType = 'admin_bbm' }: FuelRecapMenuProps) {
  const navigate = useNavigate();
  const recapQuery = reportType === 'laporan_bbm' || reportType === 'admin_bbm_pusat' ? `?reportType=${reportType}` : '';
  const editRouteBase = reportType === 'laporan_bbm' ? '/laporan-bbm/edit' : reportType === 'admin_bbm_pusat' ? '/fuel-reports-pusat/edit' : '/fuel-reports/edit';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Menu Rekap" title="Menu Rekap" className="h-10 w-10 justify-center bg-blue-600 px-0 shadow-md hover:bg-blue-700 sm:w-auto sm:px-4">
          <FileText className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Menu Rekap</span>
          <ChevronDown className="hidden h-4 w-4 opacity-70 sm:ml-2 sm:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FileText className="mr-2 h-4 w-4 text-amber-600" />
            Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onSignatureChange('with-signature')}>Ada Tanda Tangan</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSignatureChange('without-signature')}>Tanpa Tanda Tangan</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {editItems.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Data</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-80 overflow-y-auto">
              {editItems.map(item => <DropdownMenuItem key={item.id} onClick={() => navigate(`${editRouteBase}/${item.id}`)} className="cursor-pointer whitespace-normal">{item.label}</DropdownMenuItem>)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPrint} className="cursor-pointer py-2"><Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini</DropdownMenuItem>
        <DropdownMenuItem onClick={onSharePdf} className="cursor-pointer py-2"><Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-green-600" /> Simpan ke Excel</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(`/fuel-reports/daily-rekap${recapQuery}`)} className="cursor-pointer py-2"><CalendarDays className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian BBM</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/fuel-reports/weekly-rekap${recapQuery}`)} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan BBM</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/fuel-reports/monthly-rekap${recapQuery}`)} className="cursor-pointer py-2"><FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan BBM</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/fuel-reports/yearly-rekap${recapQuery}`)} className="cursor-pointer py-2"><CalendarDays className="mr-2 h-4 w-4 text-red-600" /> Rekap Tahunan BBM</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
