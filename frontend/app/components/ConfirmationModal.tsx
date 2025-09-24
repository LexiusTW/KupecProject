'use client';

import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-md">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-gray-600">{message}</p>
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700"
          >
            Удалить
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;