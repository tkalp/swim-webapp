import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { TimeStandardsSet } from '@/types/standards';
import { fetchStandardsSets, importStandards, parseCSV } from '@/services/timeStandards';

interface ImportStandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportStandardsModal: React.FC<ImportStandardsModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [standardsSetId, setStandardsSetId] = useState('');
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [standardsSets, setStandardsSets] = useState<TimeStandardsSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStandardsSets();
    }
  }, [isOpen]);

  const loadStandardsSets = async () => {
    try {
      setLoadingSets(true);
      const data = await fetchStandardsSets();
      console.log('Loaded standards sets:', data);
      const activeSets = data.filter(set => set.active);
      console.log('Active standards sets:', activeSets);
      setStandardsSets(activeSets);
    } catch (error) {
      console.error('Failed to load standards sets:', error);
    } finally {
      setLoadingSets(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      parseCSVFile(selectedFile);
    }
  };

  const parseCSVFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Parse first 5 rows for preview
      const previewData = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        return row;
      });
      
      setPreview(previewData);
    } catch (err) {
      setError('Failed to parse CSV file. Please check the format.');
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!file || !standardsSetId) {
      setError('Please select a file and standards set');
      return;
    }

    try {
      setImporting(true);
      setError('');
      
      const text = await file.text();
      const standards = parseCSV(text);
      
      const result = await importStandards(standardsSetId, standards);
      
      if (result.errors.length > 0) {
        setError(`Imported ${result.success} standards. ${result.failed} failed: ${result.errors.join(', ')}`);
      } else {
        // Reset and close on success
        setFile(null);
        setStandardsSetId('');
        setPreview(null);
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      setError('Failed to import standards. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Standards from CSV"
      size="2xl"
    >
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <p className="font-medium text-blue-400 mb-2">CSV Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Distance, Stroke, AgeGroupMin, AgeGroupMax, Gender, SCM_Time, LCM_Time, Level</li>
                <li>Times in format: HH:MM:SS.ms (e.g., 00:01:02.50)</li>
                <li>Stroke: free, back, breast, fly, im</li>
                <li>Gender: M, F, or X</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Standards Set Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Standards Set <span className="text-red-400">*</span>
          </label>
          <select
            value={standardsSetId}
            onChange={(e) => setStandardsSetId(e.target.value)}
            disabled={loadingSets}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {loadingSets ? 'Loading standards sets...' : 'Select a standards set...'}
            </option>
            {standardsSets.map(set => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.organization} {set.year})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {standardsSets.length === 0 && !loadingSets 
              ? 'Create a new standards set first'
              : 'Only active standards sets are shown'}
          </p>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            CSV File <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex items-center justify-center gap-3 p-6 bg-slate-900/50 border-2 border-dashed border-slate-600/50 hover:border-cyan-500/50 rounded-lg cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-slate-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">
                  {file ? file.name : 'Click to upload CSV file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {file ? `${(file.size / 1024).toFixed(2)} KB` : 'CSV files only'}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-400">
                Preview (first 5 rows)
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr>
                      {Object.keys(preview[0]).map((header) => (
                        <th key={header} className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <td key={i} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || !standardsSetId || importing}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : 'Import Standards'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
