'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import AuthForm from '../components/AuthForm';
import RegisterForm from '../components/RegisterForm';

import Header from '../components/Header';

type Tab = 'login' | 'register';

function AuthPageContent() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [height, setHeight] = useState<number | string>('auto');
  const formWrapperRef = useRef<HTMLDivElement>(null);
  const loginFormRef = useRef<HTMLDivElement>(null);
  const registerFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setContainerHeight = () => {
      const loginHeight = loginFormRef.current?.scrollHeight || 0;
      const registerHeight = registerFormRef.current?.scrollHeight || 0;
      const newHeight = activeTab === 'login' ? loginHeight : registerHeight;
      if (newHeight > 0) {
        setHeight(newHeight);
      }
    };

    // A small delay to allow the DOM to update before calculating height
    const timer = setTimeout(setContainerHeight, 50);

    // Recalculate on window resize
    window.addEventListener('resize', setContainerHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', setContainerHeight);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto relative">
            <div className="flex">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-3 px-6 font-medium text-lg rounded-t-lg focus:outline-none transition-all duration-300 ease-in-out ${
                  activeTab === 'login'
                    ? 'bg-white text-amber-600 shadow-lg z-10'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 mt-2'
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-3 px-6 font-medium text-lg rounded-t-lg focus:outline-none transition-all duration-300 ease-in-out ${
                  activeTab === 'register'
                    ? 'bg-white text-amber-600 shadow-lg z-10'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 mt-2'
                }`}
              >
                Регистрация
              </button>
            </div>

            <div
              ref={formWrapperRef}
              className="bg-white rounded-b-xl shadow-lg relative z-20 overflow-hidden transition-all duration-500 ease-in-out"
              style={{ height }}
            >
              <div
                ref={loginFormRef}
                className={`p-8 ${activeTab !== 'login' ? 'absolute invisible opacity-0' : ''}`}>
                <AuthForm />
              </div>
              <div
                ref={registerFormRef}
                className={`p-8 ${activeTab !== 'register' ? 'absolute invisible opacity-0' : ''}`}>
                <RegisterForm />
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}

export default function AuthPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthPageContent />
        </Suspense>
    )
}