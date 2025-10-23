'use client';

import React from 'react';

type Status = 'Заявка создана' | 'Поиск поставщиков' | 'Наценка' | 'КП отправлено' | 'Оплачено' | 'В доставке' | 'Сделка закрыта';

const ALL_STATUSES: Status[] = [
  'Заявка создана',
  'Поиск поставщиков',
  'Наценка',
  'КП отправлено',
  'Оплачено',
  'В доставке',
  'Сделка закрыта',
];

interface StatusRoadmapProps {
  currentStatus: Status;
  viewingStatus: Status;
  onSelectStatus: (newStatus: Status) => void;
}

const StatusRoadmap: React.FC<StatusRoadmapProps> = ({ currentStatus, viewingStatus, onSelectStatus }) => {
      const currentIndex = ALL_STATUSES.indexOf(currentStatus);
      const viewingIndex = ALL_STATUSES.indexOf(viewingStatus);

      return (
        <div className="flex items-center justify-between w-full px-4 py-2 bg-white rounded-lg shadow-sm">
          <div className="flex items-center space-x-2 overflow-x-auto py-2">
            {ALL_STATUSES.map((status, index) => {
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;
              const isViewing = index === viewingIndex;
              const isClickable = !isFuture;

              let lineClass = 'bg-gray-300';
              if (isCompleted) lineClass = 'bg-green-500';

              return (
                <React.Fragment key={status}>
                  <button
                    onClick={() => isClickable && onSelectStatus(status)}
                    disabled={!isClickable}
                    className={`flex items-center p-2 rounded-lg transition-colors duration-200 ${isClickable ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 flex-shrink-0 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent && isViewing
                          ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                          : isCurrent
                          ? 'bg-blue-500 text-white'
                          : isViewing // This case is for viewing past statuses
                          ? 'bg-gray-400 text-white'
                          : isFuture
                          ? 'bg-gray-200 text-gray-400'
                          : 'bg-gray-300 text-gray-500' // Past, not viewed
                      }`}
                      title={status}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span className={`ml-2 text-xs font-medium whitespace-nowrap ${isViewing ? 'text-blue-600' : isFuture ? 'text-gray-400' : 'text-gray-500'}`}>
                      {status}
                    </span>
                  </button>
                  {index < ALL_STATUSES.length - 1 && (
                     <div className={`h-1 flex-grow ${lineClass}`} style={{minWidth: '20px'}}></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    };

export default StatusRoadmap;