"use client";

import { useState } from "react";
import { ObrLayout } from "@/components/obr/obr-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileSpreadsheet, Search, Table as TableIcon } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useLanguage } from "@/lib/LanguageContext";

export default function ObrPortalPage() {
  const { lang } = useLanguage();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateReport = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/obr/report/vat?month=${month}&year=${year}`);
      setReport(data);
    } catch (err) {
      console.error(err);
      setError(lang === "fr" ? "Impossible de générer le rapport." : "Ntivyashobotse gukora icegeranyo.");
    } finally {
      setLoading(false);
    }
  };

  const escapeCsvField = (value: string | number) => {
    const str = String(value);
    return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const handleExportCsv = () => {
    if (!report) return;

    const rows: string[][] = [
      [lang === "fr" ? "Période" : "Igihe", report.metadata.period],
      [lang === "fr" ? "Total ventes HT (BIF)" : "Amaguzwa yose (BIF)", String(report.metadata.total_sales_ht)],
      [lang === "fr" ? "TVA à reverser (BIF)" : "Ikori co kwishura (BIF)", String(report.metadata.total_vat)],
      [],
      [
        lang === "fr" ? "Fermier" : "Umurimyi",
        "NIF",
        lang === "fr" ? "Ventes HT (BIF)" : "Amaguzwa adafise ikori (BIF)",
        lang === "fr" ? "TVA collectée (BIF)" : "Ikori cegeranijwe (BIF)",
      ],
      ...report.records.map((r: any) => [r.farmer_name, r.nif, String(r.sales_ht), String(r.vat_collected)]),
    ];

    // Séparateur ";" + BOM UTF-8 : Excel en locale française n'ouvre pas
    // correctement les CSV séparés par "," (utilisé comme séparateur décimal).
    const csvContent = "﻿" + rows.map((row) => row.map(escapeCsvField).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport-tva-obr-${report.metadata.period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <ObrLayout
      title={lang === "fr" ? "Rapport TVA" : "Icegeranyo c'ikori"}
      subtitle={lang === "fr" ? "TVA collectée sur AgriConnect Burundi, par mois" : "Ikori cegeranijwe kuri AgriConnect Burundi, ku kwezi"}
    >
      <div className="space-y-6">
        <Card className="border-sidebar-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium">{lang === "fr" ? "Mois" : "Ukwezi"}</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString("fr-FR", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium">{lang === "fr" ? "Année" : "Umwaka"}</label>
                <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
              </div>
              <Button onClick={generateReport} disabled={loading} className="gap-2 rounded-xl h-10 px-6 bg-sidebar-primary text-sidebar-primary-foreground">
                <Search className="w-4 h-4" />
                {lang === "fr" ? "Générer le rapport" : "Kora icegeranyo"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          </CardContent>
        </Card>

        {report && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{lang === "fr" ? "Total Ventes (HT)" : "Amaguzwa yose (adafise ikori)"}</p>
                  <p className="text-2xl font-bold">{report.metadata.total_sales_ht.toLocaleString()} BIF</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <p className="text-sm text-primary">{lang === "fr" ? "TVA à reverser (OBR)" : "Ikori co kwishura (OBR)"}</p>
                  <p className="text-2xl font-bold text-primary">{report.metadata.total_vat.toLocaleString()} BIF</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">{lang === "fr" ? "Période" : "Igihe"}</p>
                      <p className="text-lg font-bold">{report.metadata.period}</p>
                    </div>
                    <Button variant="outline" size="icon" className="rounded-xl" title={lang === "fr" ? "Bientôt disponible" : "Vyegereje"} disabled>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TableIcon className="w-5 h-5" />
                  {lang === "fr" ? "Détails par fermier" : "Ibisobanuro ku murimyi"}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={handleExportCsv}
                  disabled={report.records.length === 0}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {lang === "fr" ? "Exporter CSV" : "Kuramo CSV"}
                </Button>
              </CardHeader>
              <CardContent>
                {report.records.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {lang === "fr" ? "Aucune vente sur cette période." : "Nta muguzi kuri iki gihe."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b">
                          <th className="py-3 font-semibold">{lang === "fr" ? "Fermier" : "Umurimyi"}</th>
                          <th className="py-3 font-semibold">NIF</th>
                          <th className="py-3 font-semibold text-right">{lang === "fr" ? "Ventes HT" : "Amaguzwa adafise ikori"}</th>
                          <th className="py-3 font-semibold text-right">{lang === "fr" ? "TVA Collectée" : "Ikori cegeranijwe"}</th>
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
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ObrLayout>
  );
}
