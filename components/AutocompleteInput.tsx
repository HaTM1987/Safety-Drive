
import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { LocationPoint } from '../types';

interface AutocompleteInputProps {
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  value: LocationPoint | null;
  onChange: (location: LocationPoint) => void;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ 
  placeholder, icon, value, onChange
}) => {
  const [query, setQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimeout = useRef<any>(null);

  useEffect(() => { if (value) setQuery(value.address); }, [value]);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 3) return setSuggestions([]);
    setIsLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&countrycodes=vn&limit=5`);
      setSuggestions(await response.json());
      setShowDropdown(true);
    } catch (e) {} finally { setIsLoading(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setQuery(input);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => fetchSuggestions(input), 400);
  };

  const handleSelect = (item: any) => {
    onChange({ address: item.display_name, lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setQuery(item.display_name.split(',')[0]);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center px-5 py-3.5 space-x-3">
        <div className="flex-shrink-0">{isLoading ? <Loader2 className="animate-spin text-emerald-500" size={18} /> : icon}</div>
        <input 
          type="text" value={query} onChange={handleInputChange} onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          className="bg-transparent text-white text-sm font-medium outline-none w-full placeholder-slate-600"
          placeholder={placeholder}
        />
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[100] w-[calc(100%-1rem)] left-2 mt-1 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {suggestions.map((item, idx) => (
            <div key={idx} onClick={() => handleSelect(item)} className="p-3 hover:bg-emerald-500/10 cursor-pointer border-b border-white/5 last:border-0 transition-colors">
              <p className="text-white text-xs font-bold truncate">{item.display_name.split(',')[0]}</p>
              <p className="text-slate-500 text-[10px] truncate">{item.display_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
