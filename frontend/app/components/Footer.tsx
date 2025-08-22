'use client';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-6 text-center text-gray-500">
        <p>
          {'Copyright © 2024 "PromTrade". Все права защищены.'}
        </p>
        <p className="text-xs mt-2">
          Информация на сайте не является публичной офертой.
        </p>
      </div>
    </footer>
  );
}
