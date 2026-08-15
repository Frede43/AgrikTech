"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileSpreadsheet, Building2, Search, Table as TableIcon } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function AdminObrPage() {
  const { lang } = useLanguage();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/obr/report/vat?month=${month}&year=${year}`);
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Conformité OBR" subtitle="Rapports fiscaux et TVA collectée">
      <div className="space-y-6">
        {/* Filtres */}
        <Card className="border-sidebar-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium">Mois</label>
                <select 
                  value={month} 
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>
                      {new Date(2000, i).toLocaleString(lang === 'fr' ? 'fr-FR' : 'fr-FR', {month: 'long'})}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium">Année</label>
                <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
              </div>
              <Button onClick={generateReport} disabled={loading} className="gap-2 rounded-xl h-10 px-6 bg-sidebar-primary text-sidebar-primary-foreground">
                <Search className="w-4 h-4" />
                Générer le rapport
              </Button>
            </div>
          </CardContent>
        </Card>

        {report && (
          <div className="space-y-6">
            {/* Résumé */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Ventes (HT)</p>
                  <p className="text-2xl font-bold">{report.metadata.total_sales_ht.toLocaleString()} BIF</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <p className="text-sm text-primary">TVA à reverser (OBR)</p>
                  <p className="text-2xl font-bold text-primary">{report.metadata.total_vat.toLocaleString()} BIF</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Période</p>
                      <p className="text-lg font-bold">{report.metadata.period}</p>
                    </div>
                    <Button variant="outline" size="icon" className="rounded-xl">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Détails */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TableIcon className="w-5 h-5" />
                  Détails par fermier
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                  <FileSpreadsheet className="w-4 h-4" />
                  Exporter CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 font-semibold">Fermier</th>
                        <th className="py-3 font-semibold">NIF</th>
                        <th className="py-3 font-semibold text-right">Ventes HT</th>
                        <th className="py-3 font-semibold text-right">TVA Collectée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.records.map((r: any, i: number) => (
                        <tr key={i}>
                          <td className="py-3">{r.farmer_name}</td>
                          <td className="py-3 font-mono text-xs text-muted-foreground">{r.nif}</td>
                          <td className="py-3 text-right">{r.sales_ht.toLocaleString()}</td>
                          <td className="py-3 text-right font-bold text-primary">{r.vat_collected.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
