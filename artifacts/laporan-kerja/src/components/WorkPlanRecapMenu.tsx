import { NavigateFunction } from 'react-router-dom';
import { FileText, Image, PenTool, Table, ChevronDown, Edit, Plus, Printer, Share2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { WorkPlan } from '@/types/workPlan';

interface WorkPlanRecapMenuProps {
  navigate: NavigateFunction;
  isCompactViewport: boolean;
  isLoggedIn: boolean;
  plans: WorkPlan[];
  logoMode: 'with-logo' | 'without-logo';
  setLogoMode: (mode: 'with-logo' | 'without-logo') => void;
  signatureMode: 'with-signature' | 'without-signature';
  setSignatureMode: (mode: 'with-signature' | 'without-signature') => void;
  tableMode: 'complete' | 'compact';
  setTableMode: (mode: 'complete' | 'compact') => void;
  handleSharePdf: () => void;
  handleExportExcel: () => void;
}

const WorkPlanRecapMenu = ({
  navigate,
  isCompactViewport,
  isLoggedIn,
  plans,
  logoMode,
  setLogoMode,
  signatureMode,
  setSignatureMode,
  tableMode,
  setTableMode,
  handleSharePdf,
  handleExportExcel,
}: WorkPlanRecapMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        aria-label="Menu Rekap"
        title="Menu Rekap"
        className="h-10 w-full shrink-0 justify-center bg-blue-600 px-3 shadow-md hover:bg-blue-700 sm:w-auto sm:px-4"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span>Menu Rekap</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-64">
      {isCompactViewport ? <>
        <DropdownMenuItem onClick={() => setLogoMode(logoMode === 'with-logo' ? 'without-logo' : 'with-logo')} className="cursor-pointer py-2">
          <Image className="mr-2 h-4 w-4 shrink-0 text-blue-600" /> Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSignatureMode(signatureMode === 'with-signature' ? 'without-signature' : 'with-signature')} className="cursor-pointer py-2">
          <PenTool className="mr-2 h-4 w-4 shrink-0 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTableMode(tableMode === 'complete' ? 'compact' : 'complete')} className="cursor-pointer py-2">
          <Table className="mr-2 h-4 w-4 shrink-0 text-emerald-600" /> Mode Tabel: {tableMode === 'complete' ? 'Lengkap' : 'Ringkas'}
        </DropdownMenuItem>
        {isLoggedIn && plans.map((plan) => (
          <DropdownMenuItem key={plan.id} onClick={() => navigate(`/work-plans/edit/${plan.id}`)} className="cursor-pointer whitespace-normal py-2">
            <Edit className="mr-2 h-4 w-4 shrink-0 text-blue-600" /> Edit: {plan.category} - {plan.items[0]?.description || 'Rencana Kerja'}
          </DropdownMenuItem>
        ))}
      </> : <>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Image className="mr-2 h-4 w-4 text-blue-600" /> Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setLogoMode('with-logo')}>Dengan Logo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLogoMode('without-logo')}>Tanpa Logo</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><PenTool className="mr-2 h-4 w-4 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setSignatureMode('with-signature')}>Ada Tanda Tangan</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSignatureMode('without-signature')}>Tanpa Tanda Tangan</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Table className="mr-2 h-4 w-4 text-emerald-600" /> Mode Tabel: {tableMode === 'complete' ? 'Lengkap' : 'Ringkas'}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTableMode('complete')}>Tabel Lengkap</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTableMode('compact')}>Tabel Ringkas</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {isLoggedIn && plans.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Data</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-80">
              {plans.map((plan) => (
                <DropdownMenuItem key={plan.id} onClick={() => navigate(`/work-plans/edit/${plan.id}`)}>
                  {plan.category} - {plan.items[0]?.description || 'Rencana Kerja'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </>}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => window.print()} className="cursor-pointer py-2"><Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini</DropdownMenuItem>
      <DropdownMenuItem onClick={handleSharePdf} className="cursor-pointer py-2"><Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan</DropdownMenuItem>
      <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-green-600" /> Simpan ke Excel</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => navigate('/work-plans/daily-rekap')} className="cursor-pointer py-2"><CalendarIcon className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian</DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/work-plans/weekly-rekap')} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan</DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/work-plans/monthly-rekap')} className="cursor-pointer py-2"><FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan</DropdownMenuItem>
      {isLoggedIn && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/work-plans/create')} className="cursor-pointer py-2 text-blue-700"><Plus className="mr-2 h-4 w-4" /> Tambah Baru</DropdownMenuItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default WorkPlanRecapMenu;
