'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

// ---------- Types ----------
type RequestItem = {
  id: number;
  name: string | null;
  category: string | null;
  dims: string | null;
  size: string | null;
  stamp: string | null;
  state_standard: string | null;
  quantity: number | null;
  unit: string | null;
};

type RequestDetails = {
  id: string;
  display_id: number;
  created_at: string;
  delivery_address: string | null;
  items: RequestItem[];
};

type SupplierCol = {
  id: string;
  name: string;
  prices: Record<number, number | null>;
  deliveryIncluded: boolean;
  deliveryTime: string;
  vatIncluded: boolean;
  comment: string;
};

// ---------- Helpers ----------
const makeId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2, 9));

const formatMoney = (v?: number | null) =>
  v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('ru-RU')} ₽`;

// ---------- Component ----------
export default function RequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tableRef = useRef<HTMLDivElement>(null);

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierCol[]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [selection, setSelection] = useState<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillSourceSelection, setFillSourceSelection] = useState<typeof selection | null>(null);

  useEffect(() => {
    async function fetchRequest() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/v1/requests/${id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки заявки');
        const data = await res.json();
        setRequest(data);

        setSuppliers([
          {
            id: makeId(),
            name: 'Поставщик 1',
            prices: Object.fromEntries((data.items || []).map((i: RequestItem) => [i.id, null])),
            deliveryIncluded: false,
            deliveryTime: '',
            vatIncluded: false,
            comment: '',
          },
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRequest();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selection && !editingCell) {
        e.preventDefault();
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection, editingCell]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setActiveCell(null);
        setEditingCell(null);
        setSelection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Autofill selection handler
  useEffect(() => {
    const body = document.body;
    if (isFilling) {
      body.style.userSelect = 'none';
    } else {
      body.style.userSelect = 'auto';
    }
    return () => {
      body.style.userSelect = 'auto';
    };
  }, [isFilling]);

  // Reset selection when table structure changes
  useEffect(() => {
    setActiveCell(null);
    setEditingCell(null);
    setSelection(null);
  }, [suppliers.length]);

  const mousePosRef = useRef({ x: 0, y: 0 });

  // Auto-scroll during selection or filling
  useEffect(() => {
    if (!isSelecting && !isFilling) return;

    const table = tableRef.current;
    if (!table) return;

    const scrollZone = 50; // px
    const scrollSpeed = 10; // px per frame
    let animationFrameId: number | null = null;
    let scrollDirection: 'left' | 'right' | null = null;

    const scrollLoop = () => {
      if (!scrollDirection) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }

      table.scrollLeft += scrollDirection === 'left' ? -scrollSpeed : scrollSpeed;

      // Update selection while scrolling
      const { x, y } = mousePosRef.current;
      const element = document.elementFromPoint(x, y);
      if (element) {
        const cell = element.closest('td[data-row][data-col]');
        if (cell) {
          const row = parseInt(cell.getAttribute('data-row')!, 10);
          const col = parseInt(cell.getAttribute('data-col')!, 10);
          if (!isNaN(row) && !isNaN(col)) {
            setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
          }
        }
      }

      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      const { left, right } = table.getBoundingClientRect();
      const x = e.clientX;

      if (x < left + scrollZone) {
        scrollDirection = 'left';
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(scrollLoop);
        }
      } else if (x > right - scrollZone) {
        scrollDirection = 'right';
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(scrollLoop);
        }
      } else {
        scrollDirection = null;
        // The selection is handled by the general onMouseOver, so no need to update here
        // when not scrolling.
      }
    };

    const handleMouseUp = () => {
      scrollDirection = null;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, isFilling]);

  // Mass copy
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (!selection || editingCell) return;

      e.preventDefault();

      const range = getSelectionRange();
      if (!range) return;

      const { minRow, maxRow, minCol, maxCol } = range;

      let copyText = '';
      for (let r = minRow; r <= maxRow; r++) {
        const rowValues: (string | number | null | undefined)[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          rowValues.push(getCellValue(r, c));
        }
        copyText += rowValues.join('\t');
        if (r < maxRow) {
          copyText += '\n';
        }
      }

      navigator.clipboard.writeText(copyText).then(() => {
        // Optional: show a notification that copy was successful
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [selection, editingCell, suppliers, request]);


  const addSupplier = () => {
    if (!request) return;
    setSuppliers((prev) => [
      ...prev,
      {
        id: makeId(),
        name: `Поставщик ${prev.length + 1}`,
        prices: Object.fromEntries((request.items || []).map((i) => [i.id, null])),
        deliveryIncluded: false,
        deliveryTime: '',
        vatIncluded: false,
        comment: '',
      },
    ]);
  };

  const removeLastSupplier = () => {
    setSuppliers((prev) => prev.slice(0, -1));
  };

  const updateSupplier = (supplierId: string, changes: Partial<SupplierCol>) => {
    setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, ...changes } : s)));
  };

  const updatePrice = (supplierId: string, itemId: number, value: number | null) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId ? { ...s, prices: { ...s.prices, [itemId]: value } } : s,
      ),
    );
  };

  const calcTotal = (supplier: SupplierCol) => {
    if (!request) return 0;
    return request.items.reduce((acc, item) => {
      const p = supplier.prices[item.id];
      if (p == null || !item.quantity) return acc;
      return acc + p * item.quantity;
    }, 0);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!activeCell) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const rows = text.split(/\r?\n/).filter((r) => r.trim() !== '');
    const grid = rows.map((r) => r.split(/\t|;/));

    setSuppliers((prev) => {
      const newSuppliers = [...prev];
      grid.forEach((rowVals, ri) => {
        rowVals.forEach((val, ci) => {
          const targetRow = activeCell.row + ri;
          const targetCol = activeCell.col + ci;
          if (targetRow < request!.items.length && targetCol < newSuppliers.length) {
            const supplier = newSuppliers[targetCol];
            const item = request!.items[targetRow];
            const num = val.trim() === '' ? null : Number(val.replace(',', '.'));
            if (!Number.isNaN(num)) {
              supplier.prices[item.id] = num;
            }
          }
        });
      });
      return newSuppliers;
    });
  };

  const sendChat = () => {
    if (!messageText.trim()) return;
    setChat((prev) => [
      ...prev,
      { id: makeId(), author: 'Вы', text: messageText.trim(), createdAt: new Date().toISOString() },
    ]);
    setMessageText('');
  };

  const downloadKP = (supplier: SupplierCol) => {
    alert(`Заглушка: скачивание КП для ${supplier.name}`);
    window.print();
  };

  const handleMouseDown = (row: number, col: number) => {
    setIsSelecting(true);
    setSelection({ start: { row, col }, end: { row, col } });
    setActiveCell({ row, col });
    // setEditingCell(null); // This is handled by onBlur and handleClickOutside to prevent data loss
  };

  const handleMouseOver = (row: number, col: number) => {
    if (isSelecting) {
      setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
    } else if (isFilling && selection) {
      setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
    }
  };

  const handleMouseUp = () => {
    if (isFilling) {
      applyFill();
    }
    setIsFilling(false);
    setIsSelecting(false);
  };

  const handleDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setActiveCell({ row, col });
  };

  const handleCellUpdate = (row: number, col: number, value: any) => {
    const supplier = suppliers[col];
    if (row < request!.items.length) {
      const item = request!.items[row];
      const num = value === '' ? null : Number(value);
      updatePrice(supplier.id, item.id, Number.isNaN(num) ? null : num);
    } else {
      const fieldRow = row - request!.items.length;
      const changes: Partial<SupplierCol> = {};
      if (fieldRow === 1) changes.deliveryTime = value;
      else if (fieldRow === 4) changes.comment = value;
      updateSupplier(supplier.id, changes);
    }
  };

  const getSelectionRange = () => {
    if (!selection) return null;
    const { start, end } = selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    return { minRow, maxRow, minCol, maxCol };
  };

  const clearSelection = () => {
    const range = getSelectionRange();
    if (!range) return;

    setSuppliers(prev => {
      const newSuppliers = JSON.parse(JSON.stringify(prev));
      const { minRow, maxRow, minCol, maxCol } = range;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const supplier = newSuppliers[c];
          if (!supplier) continue;

          if (r < request!.items.length) {
            const item = request!.items[r];
            supplier.prices[item.id] = null;
          } else {
            const fieldRow = r - request!.items.length;
            if (fieldRow === 1) supplier.deliveryTime = '';
            else if (fieldRow === 4) supplier.comment = '';
          }
        }
      }
      return newSuppliers;
    });
  };

  const applyFill = () => {
    const currentSelectionRange = getSelectionRange();
    if (!currentSelectionRange || !fillSourceSelection || !activeCell) {
      if (fillSourceSelection) setFillSourceSelection(null);
      return;
    }

    const sourceSelectionRange = {
      minRow: Math.min(fillSourceSelection.start.row, fillSourceSelection.end.row),
      maxRow: Math.max(fillSourceSelection.start.row, fillSourceSelection.end.row),
      minCol: Math.min(fillSourceSelection.start.col, fillSourceSelection.end.col),
      maxCol: Math.max(fillSourceSelection.start.col, fillSourceSelection.end.col),
    };

    const sourceValue = getCellValue(activeCell.row, activeCell.col);

    setSuppliers(prev => {
      const newSuppliers = JSON.parse(JSON.stringify(prev));

      const combinedMinRow = Math.min(sourceSelectionRange.minRow, currentSelectionRange.minRow);
      const combinedMaxRow = Math.max(sourceSelectionRange.maxRow, currentSelectionRange.maxRow);
      const combinedMinCol = Math.min(sourceSelectionRange.minCol, currentSelectionRange.minCol);
      const combinedMaxCol = Math.max(sourceSelectionRange.maxCol, currentSelectionRange.maxCol);

      for (let r = combinedMinRow; r <= combinedMaxRow; r++) {
        for (let c = combinedMinCol; c <= combinedMaxCol; c++) {
          const isInCurrent = r >= currentSelectionRange.minRow && r <= currentSelectionRange.maxRow && c >= currentSelectionRange.minCol && c <= currentSelectionRange.maxCol;
          const isInSource = r >= sourceSelectionRange.minRow && r <= sourceSelectionRange.maxRow && c >= sourceSelectionRange.minCol && c <= sourceSelectionRange.maxCol;

          const supplier = newSuppliers[c];
          if (!supplier) continue;

          const updateValue = (val: any) => {
            if (r < request!.items.length) {
              const item = request!.items[r];
              const num = val === '' || val == null ? null : Number(val);
              supplier.prices[item.id] = Number.isNaN(num) ? null : num;
            }
            else {
              const fieldRow = r - request!.items.length;
              if (fieldRow === 1) supplier.deliveryTime = val;
              else if (fieldRow === 4) supplier.comment = val;
            }
          };

          if (isInCurrent && !isInSource) {
            updateValue(sourceValue);
          } else if (isInSource && !isInCurrent) {
            updateValue('');
          }
        }
      }
      return newSuppliers;
    });

    setFillSourceSelection(null); // Clean up
  };

  const getCellValue = (row: number, col: number) => {
    if (!request || !suppliers[col]) return '';
    const supplier = suppliers[col];
    if (row < request.items.length) {
      return supplier.prices[request.items[row].id];
    } else {
      const fieldRow = row - request.items.length;
      if (fieldRow === 1) return supplier.deliveryTime;
      if (fieldRow === 4) return supplier.comment;
    }
    return '';
  };

  const [messageText, setMessageText] = useState('');
  const [chat, setChat] = useState<any[]>([]);

  const isCellSelected = (row: number, col: number) => {
    const range = getSelectionRange();
    if (!range) return false;
    const { minRow, maxRow, minCol, maxCol } = range;
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  const getSelectionStyle = (): React.CSSProperties => {
    if (!selection || !tableRef.current) return { display: 'none' };

    const range = getSelectionRange()!;
    const startCell = tableRef.current.querySelector(`[data-row='${range.minRow}'][data-col='${range.minCol}']`) as HTMLElement;
    const endCell = tableRef.current.querySelector(`[data-row='${range.maxRow}'][data-col='${range.maxCol}']`) as HTMLElement;

    if (!startCell || !endCell) return { display: 'none' };

    const style: React.CSSProperties = {
      position: 'absolute',
      left: startCell.offsetLeft,
      top: startCell.offsetTop,
      width: (endCell.offsetLeft + endCell.offsetWidth) - startCell.offsetLeft,
      height: (endCell.offsetTop + endCell.offsetHeight) - startCell.offsetTop,
      pointerEvents: 'none',
      zIndex: 15,
    };

    if (!isFilling) {
      style.border = '2px solid #F97316';
    }

    return style;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto p-8">
          <div className="bg-white p-8 rounded shadow text-center">Загрузка...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto p-8">
          <div className="bg-white p-8 rounded shadow text-center">Заявка не найдена</div>
        </main>
        <Footer />
      </div>
    );
  }

  const selectionStyle = getSelectionStyle();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
        {/* Шапка */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Заявка №{request.display_id}</h1>
          <p className="text-gray-500 text-sm">Создана: {new Date(request.created_at).toLocaleDateString('ru-RU')}</p>
          <p className="text-gray-500 text-sm">Адрес доставки: {request.delivery_address || '—'}</p>
        </div>

        {/* Таблица */}
        <div ref={tableRef} className="bg-white rounded-xl shadow-md overflow-x-auto p-4 relative" onMouseUp={handleMouseUp}>
          <div
            style={selectionStyle}
            className={isFilling ? 'selection-border-animated' : ''}
          />
          {selection && (
             <div
                className="absolute w-2 h-2 bg-orange-600 border border-white cursor-crosshair"
                style={{
                  left: selectionStyle.left as number + (selectionStyle.width as number) - 4,
                  top: selectionStyle.top as number + (selectionStyle.height as number) - 4,
                  zIndex: 20,
                  pointerEvents: 'auto'
                }}
                onMouseDown={() => {
                  setIsFilling(true);
                  setFillSourceSelection(selection);
                }}
             />
          )}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Позиции</h2>
            <div className="flex gap-2">
                <button
                    onClick={removeLastSupplier}
                    disabled={suppliers.length <= 1}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                    Удалить последнего
                </button>
                <button onClick={addSupplier} className="px-3 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">
                    + Добавить поставщика
                </button>
            </div>
          </div>

          <table className="min-w-full border border-gray-300 text-sm select-none" onPaste={handlePaste}>
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 w-8">№</th>
                <th className="border p-2 w-48">Наименование</th>
                <th className="border p-2 w-20">Кол-во</th>
                <th className="border p-2 w-16">Ед.</th>
                {suppliers.map((s, colIndex) => (
                  <th key={s.id} className="border p-0 min-w-[120px] relative whitespace-nowrap w-auto">
                    <EditableCell
                      value={s.name}
                      isEditing={editingCell?.row === -1 && editingCell?.col === colIndex}
                      onDoubleClick={() => setEditingCell({ row: -1, col: colIndex })}
                      onUpdate={(value) => updateSupplier(s.id, { name: value })}
                      onStopEditing={() => setEditingCell(null)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {request.items.map((item, rowIndex) => (
                <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border p-2">{rowIndex + 1}</td>
                  <td className="border p-2">{item.name || item.category}</td>
                  <td className="border p-2">{item.quantity}</td>
                  <td className="border p-2">{item.unit || 'шт.'}</td>
                  {suppliers.map((s, colIndex) => {
                    const val = s.prices[item.id];
                    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                    return (
                      <td
                        key={s.id}
                        data-row={rowIndex}
                        data-col={colIndex}
                        className={`border p-0 relative`}
                        onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                        onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                        onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                      >
                        <EditableCell
                          value={val}
                          isEditing={isEditing}
                          onUpdate={(value) => handleCellUpdate(rowIndex, colIndex, value)}
                          onStopEditing={() => setEditingCell(null)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Итоговые строки */}
              <tr className="bg-gray-100">
                <td colSpan={4} className="border p-2 font-medium">Доставка включена?</td>
                {suppliers.map((s, colIndex) => (
                  <td key={s.id} data-row={request.items.length} data-col={colIndex} className="border p-2 text-center cursor-pointer" onClick={() => updateSupplier(s.id, { deliveryIncluded: !s.deliveryIncluded }) }>
                    <input
                      type="checkbox"
                      readOnly
                      checked={s.deliveryIncluded}
                      className="pointer-events-none"
                    />
                  </td>
                ))}
              </tr>

              <tr>
                <td colSpan={4} className="border p-2 font-medium">Срок доставки</td>
                {suppliers.map((s, colIndex) => {
                  const rowIndex = request.items.length + 1;
                  return (
                    <td key={s.id} data-row={rowIndex} data-col={colIndex} className="border p-0 relative"
                        onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                        onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                        onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)} >
                       <EditableCell
                          value={s.deliveryTime}
                          isEditing={editingCell?.row === rowIndex && editingCell?.col === colIndex}
                          onUpdate={(value) => updateSupplier(s.id, { deliveryTime: value })}
                          onStopEditing={() => setEditingCell(null)}
                        />
                    </td>
                  )
                })}
              </tr>

              <tr className="bg-gray-100">
                <td colSpan={4} className="border p-2 font-medium">Включён ли НДС?</td>
                {suppliers.map((s, colIndex) => (
                  <td key={s.id} data-row={request.items.length + 2} data-col={colIndex} className="border p-2 text-center cursor-pointer" onClick={() => updateSupplier(s.id, { vatIncluded: !s.vatIncluded }) }>
                    <input
                      type="checkbox"
                      readOnly
                      checked={s.vatIncluded}
                      className="pointer-events-none"
                    />
                  </td>
                ))}
              </tr>

              <tr>
                <td colSpan={4} className="border p-2 font-medium">Общая стоимость</td>
                {suppliers.map((s) => (
                  <td key={s.id} className="border p-2 font-semibold">{formatMoney(calcTotal(s))}</td>
                ))}
              </tr>

              <tr className="bg-gray-50">
                <td colSpan={4} className="border p-2 font-medium">Комментарий</td>
                {suppliers.map((s, colIndex) => {
                   const rowIndex = request.items.length + 4;
                   return (
                    <td key={s.id} data-row={rowIndex} data-col={colIndex} className="border p-0 relative"
                        onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                        onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                        onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)} >
                       <EditableCell
                          value={s.comment}
                          isEditing={editingCell?.row === rowIndex && editingCell?.col === colIndex}
                          onUpdate={(value) => updateSupplier(s.id, { comment: value })}
                          onStopEditing={() => setEditingCell(null)}
                          isTextarea
                        />
                    </td>
                  )
                })}
              </tr>

              <tr>
                <td colSpan={4} className="border p-2"></td>
                {suppliers.map((s) => (
                  <td key={s.id} className="border p-2 text-center">
                    <button
                      onClick={() => downloadKP(s)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                    >
                      Скачать КП
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Чат */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="font-semibold mb-4">Комментарии по заявке</h3>
          <div className="max-h-64 overflow-y-auto border rounded p-3 space-y-3 mb-4">
            {chat.length === 0 && <div className="text-sm text-gray-500">Нет комментариев</div>}
            {chat.map((m) => (
              <div key={m.id}>
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="font-medium">{m.author}</span>
                  <span>{new Date(m.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <p className="text-sm">{m.text}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="Ваш комментарий..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <button onClick={sendChat} className="px-3 py-2 bg-amber-600 text-white rounded">
              Отправить
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}


interface EditableCellProps {
  value: string | number | null | undefined;
  isEditing: boolean;
  isTextarea?: boolean;
  placeholder?: string;
  onUpdate: (value: string) => void;
  onStopEditing: () => void;
  onDoubleClick?: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, isEditing, isTextarea, placeholder, onUpdate, onStopEditing, onDoubleClick }) => {
  const [currentValue, setCurrentValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentValue(value?.toString() || '');
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      const element = inputRef.current || textareaRef.current;
      if (element) {
        element.focus();
        element.select();
      }
    }
  }, [isEditing]);

  const handleBlur = () => {
    onUpdate(currentValue);
    onStopEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isTextarea) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCurrentValue(value?.toString() || '');
      onStopEditing();
    }
  };

  if (isEditing) {
    return isTextarea ? (
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full p-2 box-border border-2 border-orange-600 outline-none resize-none z-10"
      />
    ) : (
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full p-2 box-border border-2 border-orange-600 outline-none z-10"
      />
    );
  }

  return (
    <div className="w-full h-full p-2" onDoubleClick={onDoubleClick}>
      {(value != null && value !== '') ? value : (
        <span className="text-gray-400 italic">{placeholder}</span>
      )}
    </div>
  );
};