'use client';

import { useState } from 'react';
import SearchForm, { SearchFormData } from '../components/SearchForm';
import ResultsTable from '../components/ResultsTable';
import ProductModal from '../components/ProductModal';
import GostModal from '../components/GostModal';
import Header from '../components/Header';
import UpdateStatus from '../components/UpdateStatus';
import Footer from '../components/Footer';
import type { Product } from '../components/types';

export default function Home() {
  const [filters, setFilters] = useState<SearchFormData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedGost, setSelectedGost] = useState<{ gost: string; product: Product } | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showGostModal, setShowGostModal] = useState(false);

  const handleSearch = async (data: SearchFormData) => {
    setFilters(data);
  };

  const handleShowDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleShowGost = (gost: string, product: Product) => {
    setSelectedGost({ gost, product });
    setShowGostModal(true);
    setShowProductModal(false);
  };

  const handleCloseModals = () => {
    setShowProductModal(false);
    setShowGostModal(false);
    setSelectedProduct(null);
    setSelectedGost(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />

      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Поиск металлопроката</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Найдите нужные металлоконструкции по параметрам: категория, материал, ГОСТ, размеры и поставщик
            </p>
          </div>

          <div id="search">
            <SearchForm onSearch={handleSearch} />
          </div>

          {filters &&
            <div className="mt-8">
              <div className="flex justify-end mb-2">
                <UpdateStatus />
              </div>
              <ResultsTable filters={filters} onShowDetails={handleShowDetails} />
            </div>}

          {showProductModal && selectedProduct && (
            <ProductModal
              product={selectedProduct}
              onClose={handleCloseModals}
              onShowGost={handleShowGost}
            />
          )}

          {showGostModal && selectedGost && (
            <GostModal
              gost={selectedGost.gost}
              product={selectedGost.product}
              onClose={handleCloseModals}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
