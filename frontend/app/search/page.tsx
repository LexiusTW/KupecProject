"use client";

import { useState } from "react";

import SearchForm, { SearchFormData } from "../components/SearchForm";
import ResultsTable from "../components/ResultsTable";
import ProductModal from "../components/ProductModal";
import GostModal from "../components/GostModal";
import UpdateStatus from "../components/UpdateStatus";
import { Container } from "../components/base/Container/Container";

import type { Product } from "../components/types";

import { rc } from "../utils/rc";

import css from "./page.module.css";

export default function Home() {
  const [filters, setFilters] = useState<SearchFormData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedGost, setSelectedGost] = useState<{
    gost: string;
    product: Product;
  } | null>(null);
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
    <div className={css.section}>
      <Container>
        <div className={css.inner}>
          <div className={css.box}>
            <h1 className="h1">Поиск металлопроката</h1>

            <div className="textbox">
              <p className={rc(["p1", css.p1])}>
                Найдите нужные металлоконструкции по параметрам: категория,
                материал, ГОСТ, размеры и поставщик
              </p>
            </div>
          </div>

          <div id="search">
            <SearchForm onSearch={handleSearch} />
          </div>

          {filters && (
            <div className={css.block}>
              <div style={{marginLeft: 'auto'}}>
                <UpdateStatus />
              </div>
              
              <ResultsTable
                filters={filters}
                onShowDetails={handleShowDetails}
              />
            </div>
          )}

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
      </Container>
    </div>
  );
}
