import React, { useState } from 'react';
import { X } from 'lucide-react';

interface InputDialogProps {
  title: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'number';
  maxValue?: number;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function InputDialog({ 
  title, 
  label, 
  placeholder, 
  type = 'text',
  maxValue,
  onConfirm, 
  onClose 
}: InputDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!value.trim()) {
      setError('This field is required');
      return;
    }

    if (type === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) {
        setError('Please enter a valid number');
        return;
      }
      if (maxValue && numValue > maxValue) {
        setError(`Maximum value is ${maxValue}`);
        return;
      }
    }

    onConfirm(value.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md">
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 p-2 -mr-2"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {label}
            </label>
            <input
              type={type}
              inputMode={type === 'number' ? 'decimal' : 'text'}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
              placeholder={placeholder}
              className="w-full px-4 py-3 sm:py-4 text-base sm:text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              className="flex-1 bg-indigo-600 text-white px-4 py-3 sm:py-4 rounded-lg hover:bg-indigo-700 transition font-medium text-base sm:text-lg"
            >
              Confirm
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-3 sm:py-4 rounded-lg hover:bg-gray-400 transition font-medium text-base sm:text-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}