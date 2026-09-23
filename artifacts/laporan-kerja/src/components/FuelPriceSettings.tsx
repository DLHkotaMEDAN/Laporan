"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, Save, Loader2, Fuel } from 'lucide-react';
import { fuelPriceService } from '@/services/fuelPriceService';
import { fuelPusatPriceService } from '@/services/fuelPusatPriceService';
import { showSuccess, showError } from '@/utils/toast';

interface FuelPriceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  isPusat?: boolean;
}

const FuelPriceSettings = ({ isOpen, onClose, onUpdated, isPusat = false }: FuelPriceSettingsProps) => {
  const [prices, setPrices] = useState({ Pertamax: 0, Dexlite: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) fetchPrices();
  }, [isOpen, isPusat]);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const data = await (isPusat ? fuelPusatPriceService : fuelPriceService).getPrices();
      const p = data.find(x => x.type === 'Pertamax')?.price || 0;
      const d = data.find(x => x.type === 'Dexlite')?.price || 0;
      setPrices({ Pertamax: p, Dexlite: d });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const priceService = isPusat ? fuelPusatPriceService : fuelPriceService;
      await priceService.updatePrice('Pertamax', prices.Pertamax);
      await priceService.updatePrice('Dexlite', prices.Dexlite);
      showSuccess("Harga BBM berhasil diperbarui");
      if (onUpdated) onUpdated();
      onClose();
    } catch (e) {
      showError("Gagal menyimpan harga");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" /> Master Harga BBM
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          <p className="text-xs text-slate-500 italic">Harga ini akan digunakan sebagai pembagi otomatis untuk menghitung jumlah Liter pada laporan SPJ.</p>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-blue-700 font-bold flex items-center gap-2">
                <Fuel size={14} /> Harga Pertamax (Rp/Liter)
              </Label>
              <Input 
                type="number" 
                value={prices.Pertamax} 
                onChange={(e) => setPrices({...prices, Pertamax: Number(e.target.value)})}
                className="h-11 font-bold text-lg"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-green-700 font-bold flex items-center gap-2">
                <Fuel size={14} /> Harga Dexlite (Rp/Liter)
              </Label>
              <Input 
                type="number" 
                value={prices.Dexlite} 
                onChange={(e) => setPrices({...prices, Dexlite: Number(e.target.value)})}
                className="h-11 font-bold text-lg"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-blue-600">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Harga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FuelPriceSettings;
